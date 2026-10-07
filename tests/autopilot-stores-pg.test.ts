/**
 * PgAutopilotStore and PgApprovalStore against real Postgres (PGlite).
 *
 * The last section is the one that matters most: it runs the *actual*
 * AutopilotEngine with the Postgres stores wired in, so the email lane is
 * exercised end to end against real SQL — thread creation, draft, Level C
 * approval, send, and the shared idempotency record.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { ApprovalService } from '@hutchrok-os/approvals';
import { ProviderReceiptService } from '@hutchrok-os/activity';
import { AuditService, InMemoryAuditSink } from '@hutchrok-os/audit';
import {
  AutopilotEngine,
  InMemoryEventPublisher,
  type AutopilotTask,
  type EmailDraft,
  type Thread,
} from '@hutchrok-os/autopilot';
import { MockEmailConnector, type InboundEmail } from '@hutchrok-os/connectors';
import {
  PgApprovalStore,
  PgAutopilotStore,
  PgProviderReceiptStore,
} from '@hutchrok-os/db/stores';
import type { Approval } from '@hutchrok-os/domain';
import { generateId, nowISO } from '@hutchrok-os/shared';

import { createTestDatabase, type TestDatabase } from './helpers/pg.js';

const BINDING = {
  tenantId: 'hutchrok-solutions-group',
  companyId: 'hutchrok-solutions-group',
};

let harness: TestDatabase;
let store: PgAutopilotStore;
let approvalStore: PgApprovalStore;
let receipts: ProviderReceiptService;

beforeAll(async () => {
  harness = await createTestDatabase();
  receipts = new ProviderReceiptService(new PgProviderReceiptStore(harness.db));
  store = new PgAutopilotStore(harness.db, receipts.keyClaimerFor(BINDING));
  approvalStore = new PgApprovalStore(harness.db);
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.client.exec(`
    TRUNCATE email_messages, email_drafts, autopilot_tasks, email_threads,
             email_contacts, approvals, provider_event_receipts
    RESTART IDENTITY CASCADE;
  `);
});

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function thread(overrides: Partial<Thread> = {}): Thread {
  const now = nowISO();
  const id = overrides.id ?? generateId();
  return {
    id,
    ref: `HK-${id.slice(0, 8)}`,
    contactEmail: 'applicant@example.invalid',
    contactName: 'Sample Applicant',
    subject: 'Veteran LLC filing question',
    subjectKey: 'veteran llc filing question',
    intent: 'filing_question',
    sensitivity: 'INTERNAL',
    status: 'open',
    source: 'email',
    messages: [],
    followUpsSent: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function draft(overrides: Partial<EmailDraft> = {}): EmailDraft {
  const now = nowISO();
  return {
    id: generateId(),
    kind: 'reply',
    to: ['applicant@example.invalid'],
    subject: 'Re: Veteran LLC filing question',
    text: 'Thank you for reaching out.',
    status: 'pending_approval',
    generatedBy: 'template',
    correlationId: 'corr_pg',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function task(overrides: Partial<AutopilotTask> = {}): AutopilotTask {
  const now = nowISO();
  return {
    id: generateId(),
    queue: 'intake',
    title: 'Review filing question',
    agentId: 'intake',
    status: 'open',
    dueAt: now,
    correlationId: 'corr_pg',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function approval(overrides: Partial<Approval> = {}): Approval {
  const now = nowISO();
  return {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    entityType: 'email_reply',
    entityId: generateId(),
    level: 'C',
    requestedByAgentId: 'site-autopilot',
    status: 'PENDING',
    metadata: {},
    ...overrides,
  };
}

// ─────────────────────────────────────────
// THREADS
// ─────────────────────────────────────────

describe('PgAutopilotStore — threads', () => {
  it('round-trips a thread with no messages', async () => {
    const t = thread();
    await store.saveThread(t);

    const found = await store.getThread(t.id);
    expect(found).not.toBeNull();
    expect(found?.ref).toBe(t.ref);
    expect(found?.contactEmail).toBe(t.contactEmail);
    expect(found?.contactName).toBe('Sample Applicant');
    expect(found?.intent).toBe('filing_question');
    expect(found?.status).toBe('open');
    expect(found?.source).toBe('email');
    expect(found?.messages).toEqual([]);
    expect(found?.signalId).toBeUndefined();
  });

  it('persists nested messages into the child table', async () => {
    const t = thread({
      messages: [
        {
          id: generateId(),
          direction: 'INBOUND',
          from: 'applicant@example.invalid',
          to: ['contact@hutchrok.com'],
          subject: 'Veteran LLC filing question',
          textRedacted: 'Do I qualify?',
          internetMessageId: '<msg-1@example.invalid>',
          at: nowISO(),
          kind: 'email',
        },
      ],
    });
    await store.saveThread(t);

    const found = await store.getThread(t.id);
    expect(found?.messages).toHaveLength(1);
    expect(found?.messages[0]?.textRedacted).toBe('Do I qualify?');
    expect(found?.messages[0]?.internetMessageId).toBe('<msg-1@example.invalid>');
    expect(found?.messages[0]?.to).toEqual(['contact@hutchrok.com']);
    expect(found?.messages[0]?.kind).toBe('email');
  });

  it('does not duplicate messages when the same thread is saved repeatedly', async () => {
    const t = thread({
      messages: [
        {
          id: generateId(),
          direction: 'INBOUND',
          from: 'applicant@example.invalid',
          to: ['contact@hutchrok.com'],
          subject: 'Q',
          textRedacted: 'first',
          at: nowISO(),
        },
      ],
    });

    await store.saveThread(t);
    await store.saveThread(t);
    await store.saveThread(t);

    const found = await store.getThread(t.id);
    expect(found?.messages).toHaveLength(1);

    const count = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM email_messages`
    );
    expect(count.rows[0]?.n).toBe(1);
  });

  it('appends a new message on a later save and keeps both', async () => {
    const first = {
      id: generateId(),
      direction: 'INBOUND' as const,
      from: 'applicant@example.invalid',
      to: ['contact@hutchrok.com'],
      subject: 'Q',
      textRedacted: 'first',
      at: new Date(Date.now() - 60_000).toISOString(),
    };
    const t = thread({ messages: [first] });
    await store.saveThread(t);

    const second = {
      id: generateId(),
      direction: 'OUTBOUND' as const,
      from: 'contact@hutchrok.com',
      to: ['applicant@example.invalid'],
      subject: 'Re: Q',
      textRedacted: 'second',
      at: nowISO(),
      kind: 'acknowledgment' as const,
    };
    await store.saveThread({ ...t, messages: [first, second], updatedAt: nowISO() });

    const found = await store.getThread(t.id);
    expect(found?.messages).toHaveLength(2);
    // Ordered by sent time.
    expect(found?.messages[0]?.textRedacted).toBe('first');
    expect(found?.messages[1]?.textRedacted).toBe('second');
  });

  it('updates mutable thread fields in place', async () => {
    const t = thread();
    await store.saveThread(t);

    await store.saveThread({
      ...t,
      status: 'awaiting_customer',
      sensitivity: 'RESTRICTED',
      followUpsSent: 2,
      lastOutboundAt: nowISO(),
      updatedAt: nowISO(),
    });

    const found = await store.getThread(t.id);
    expect(found?.status).toBe('awaiting_customer');
    expect(found?.sensitivity).toBe('RESTRICTED');
    expect(found?.followUpsSent).toBe(2);
    expect(found?.lastOutboundAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    const count = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM email_threads`
    );
    expect(count.rows[0]?.n).toBe(1);
  });

  it('finds a thread by ref', async () => {
    const t = thread();
    await store.saveThread(t);
    expect((await store.findThreadByRef(t.ref))?.id).toBe(t.id);
    expect(await store.findThreadByRef('HK-nope')).toBeNull();
  });

  it('finds a thread by any of its internet message ids', async () => {
    const t = thread({
      messages: [
        {
          id: generateId(),
          direction: 'INBOUND',
          from: 'applicant@example.invalid',
          to: ['contact@hutchrok.com'],
          subject: 'Q',
          textRedacted: 'x',
          internetMessageId: '<a@example.invalid>',
          at: nowISO(),
        },
      ],
    });
    await store.saveThread(t);

    expect((await store.findThreadByMessageIds(['<a@example.invalid>']))?.id).toBe(t.id);
    expect(
      (await store.findThreadByMessageIds(['<zzz@x>', '<a@example.invalid>']))?.id
    ).toBe(t.id);
    expect(await store.findThreadByMessageIds(['<zzz@x>'])).toBeNull();
    expect(await store.findThreadByMessageIds([])).toBeNull();
  });

  it('finds a recent thread by contact and subject key, respecting the window', async () => {
    const t = thread();
    await store.saveThread(t);

    const hit = await store.findRecentThread(
      t.contactEmail,
      t.subjectKey,
      new Date(Date.now() - 60_000).toISOString()
    );
    expect(hit?.id).toBe(t.id);

    const miss = await store.findRecentThread(
      t.contactEmail,
      t.subjectKey,
      new Date(Date.now() + 60_000).toISOString()
    );
    expect(miss).toBeNull();

    expect(await store.findRecentThread('other@example.invalid', t.subjectKey, '1970-01-01T00:00:00.000Z')).toBeNull();
  });

  it('lists threads newest first and honours status and limit', async () => {
    await store.saveThread(thread({ status: 'open', updatedAt: '2026-01-01T00:00:00.000Z' }));
    await store.saveThread(thread({ status: 'closed', updatedAt: '2026-02-01T00:00:00.000Z' }));
    await store.saveThread(thread({ status: 'open', updatedAt: '2026-03-01T00:00:00.000Z' }));

    const all = await store.listThreads();
    expect(all).toHaveLength(3);
    expect(all[0]?.updatedAt).toContain('2026-03-01');

    expect(await store.listThreads({ status: 'open' })).toHaveLength(2);
    expect(await store.listThreads({ limit: 1 })).toHaveLength(1);
  });

  it('returns null for an unknown thread', async () => {
    expect(await store.getThread('44444444-4444-4444-8444-444444444444')).toBeNull();
  });
});

// ─────────────────────────────────────────
// DRAFTS
// ─────────────────────────────────────────

describe('PgAutopilotStore — drafts', () => {
  it('round-trips a draft, including the reserved "references" column', async () => {
    const t = thread();
    await store.saveThread(t);

    const d = draft({
      threadId: t.id,
      inReplyTo: '<msg-1@example.invalid>',
      references: ['<msg-0@example.invalid>', '<msg-1@example.invalid>'],
    });
    await store.saveDraft(d);

    const found = await store.getDraft(d.id);
    expect(found?.subject).toBe(d.subject);
    expect(found?.text).toBe(d.text);
    expect(found?.to).toEqual(['applicant@example.invalid']);
    expect(found?.inReplyTo).toBe('<msg-1@example.invalid>');
    expect(found?.references).toEqual([
      '<msg-0@example.invalid>',
      '<msg-1@example.invalid>',
    ]);
    expect(found?.status).toBe('pending_approval');
    expect(found?.generatedBy).toBe('template');
    expect(found?.error).toBeUndefined();
  });

  it('omits references entirely when there are none', async () => {
    const d = draft();
    await store.saveDraft(d);
    expect((await store.getDraft(d.id))?.references).toBeUndefined();
  });

  it('updates a draft in place as it moves to sent', async () => {
    const d = draft();
    await store.saveDraft(d);

    await store.saveDraft({
      ...d,
      status: 'sent',
      providerMessageId: 'msg_provider_1',
      updatedAt: nowISO(),
    });

    const found = await store.getDraft(d.id);
    expect(found?.status).toBe('sent');
    expect(found?.providerMessageId).toBe('msg_provider_1');

    const count = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM email_drafts`
    );
    expect(count.rows[0]?.n).toBe(1);
  });

  it('finds a draft by its approval, honouring the foreign key', async () => {
    const a = approval();
    await approvalStore.create(a);

    const d = draft({ approvalId: a.id });
    await store.saveDraft(d);

    expect((await store.findDraftByApproval(a.id))?.id).toBe(d.id);
    expect(await store.findDraftByApproval(generateId())).toBeNull();
  });

  it('rejects a draft pointing at an approval that does not exist', async () => {
    // The FK is a real constraint: a dangling approval reference fails here
    // where the in-memory store would accept it.
    await expect(store.saveDraft(draft({ approvalId: generateId() }))).rejects.toThrow();
  });

  it('lists drafts newest first, filtered by status', async () => {
    await store.saveDraft(draft({ status: 'pending_approval', createdAt: '2026-01-01T00:00:00.000Z' }));
    await store.saveDraft(draft({ status: 'sent', createdAt: '2026-02-01T00:00:00.000Z' }));
    await store.saveDraft(draft({ status: 'pending_approval', createdAt: '2026-03-01T00:00:00.000Z' }));

    expect(await store.listDrafts()).toHaveLength(3);
    expect(await store.listDrafts({ status: 'pending_approval' })).toHaveLength(2);
    expect((await store.listDrafts())[0]?.createdAt).toContain('2026-03-01');
    expect(await store.listDrafts({ limit: 1 })).toHaveLength(1);
  });
});

// ─────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────

describe('PgAutopilotStore — tasks', () => {
  it('round-trips a task and updates it in place', async () => {
    const t = task();
    await store.saveTask(t);

    const [found] = await store.listTasks();
    expect(found?.title).toBe('Review filing question');
    expect(found?.agentId).toBe('intake');
    expect(found?.status).toBe('open');
    expect(found?.escalatedAt).toBeUndefined();

    await store.saveTask({ ...t, status: 'escalated', escalatedAt: nowISO() });
    const [updated] = await store.listTasks({ status: 'escalated' });
    expect(updated?.escalatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(await store.listTasks({ status: 'open' })).toHaveLength(0);
  });

  it('links a task to its thread', async () => {
    const t = thread();
    await store.saveThread(t);
    await store.saveTask(task({ threadId: t.id }));

    const [found] = await store.listTasks();
    expect(found?.threadId).toBe(t.id);
  });

  it('lists tasks by due date and filters by queue', async () => {
    await store.saveTask(task({ queue: 'intake', dueAt: '2026-03-01T00:00:00.000Z' }));
    await store.saveTask(task({ queue: 'filing', dueAt: '2026-01-01T00:00:00.000Z' }));

    const all = await store.listTasks();
    expect(all).toHaveLength(2);
    // Soonest due first.
    expect(all[0]?.dueAt).toContain('2026-01-01');
    expect(await store.listTasks({ queue: 'filing' })).toHaveLength(1);
  });
});

// ─────────────────────────────────────────
// CONTACT STATE
// ─────────────────────────────────────────

describe('PgAutopilotStore — contact state', () => {
  it('treats an unknown contact as not suppressed', async () => {
    expect(await store.isSuppressed('nobody@example.invalid')).toBe(false);
  });

  it('suppresses a contact idempotently and case-insensitively', async () => {
    await store.suppress('Applicant@Example.Invalid');
    expect(await store.isSuppressed('applicant@example.invalid')).toBe(true);
    expect(await store.isSuppressed('APPLICANT@EXAMPLE.INVALID')).toBe(true);

    await store.suppress('applicant@example.invalid');
    const count = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM email_contacts`
    );
    expect(count.rows[0]?.n).toBe(1);
  });

  it('records and reads the acknowledgement cooldown', async () => {
    expect(await store.lastAcknowledgedAt('applicant@example.invalid')).toBeNull();

    const at = nowISO();
    await store.markAcknowledged('Applicant@Example.Invalid', at);

    const read = await store.lastAcknowledgedAt('applicant@example.invalid');
    expect(read).not.toBeNull();
    expect(Date.parse(read!)).toBe(Date.parse(at));
  });

  it('keeps suppression and cooldown on one row per contact', async () => {
    await store.suppress('applicant@example.invalid');
    await store.markAcknowledged('applicant@example.invalid', nowISO());

    const count = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM email_contacts`
    );
    expect(count.rows[0]?.n).toBe(1);
    // Marking an acknowledgement must not clear suppression.
    expect(await store.isSuppressed('applicant@example.invalid')).toBe(true);
  });
});

// ─────────────────────────────────────────
// APPROVALS
// ─────────────────────────────────────────

describe('PgApprovalStore', () => {
  it('round-trips an approval', async () => {
    const a = approval({ reason: 'reply to applicant', correlationId: 'corr_x' });
    await approvalStore.create(a);

    const found = await approvalStore.findById(a.id);
    expect(found?.level).toBe('C');
    expect(found?.status).toBe('PENDING');
    expect(found?.requestedByAgentId).toBe('site-autopilot');
    expect(found?.reason).toBe('reply to applicant');
    expect(found?.correlationId).toBe('corr_x');
    expect(found?.approvedByUserId).toBeUndefined();
    expect(found?.expiresAt).toBeUndefined();
  });

  it('accepts a non-uuid approver id — the reason migration 0001 exists', async () => {
    const a = approval();
    await approvalStore.create(a);

    const resolved = await approvalStore.resolvePending(a.id, 'APPROVED', 'fee', 'looks good');
    expect(resolved?.status).toBe('APPROVED');
    expect(resolved?.approvedByUserId).toBe('fee');
  });

  it('accepts an agent id as the rejecter when a draft is superseded', async () => {
    const a = approval();
    await approvalStore.create(a);

    const resolved = await approvalStore.resolvePending(
      a.id,
      'REJECTED',
      'site-autopilot',
      'Superseded by a newer draft on the same thread.'
    );
    expect(resolved?.status).toBe('REJECTED');
    expect(resolved?.approvedByUserId).toBe('site-autopilot');
  });

  it('resolves exactly once under a race', async () => {
    const a = approval();
    await approvalStore.create(a);

    const [first, second] = await Promise.all([
      approvalStore.resolvePending(a.id, 'APPROVED', 'fee'),
      approvalStore.resolvePending(a.id, 'APPROVED', 'fee'),
    ]);

    const winners = [first, second].filter((r) => r !== null);
    expect(winners).toHaveLength(1);
  });

  it('expires instead of approving when the deadline has passed', async () => {
    const a = approval({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    await approvalStore.create(a);

    // Null means "not resolved by you".
    expect(await approvalStore.resolvePending(a.id, 'APPROVED', 'fee')).toBeNull();

    const after = await approvalStore.findById(a.id);
    expect(after?.status).toBe('EXPIRED');
    expect(after?.approvedByUserId).toBeUndefined();
  });

  it('will not resolve an approval that is not PENDING', async () => {
    const a = approval();
    await approvalStore.create(a);
    await approvalStore.resolvePending(a.id, 'APPROVED', 'fee');
    expect(await approvalStore.resolvePending(a.id, 'REJECTED', 'fee')).toBeNull();
  });

  it('lists pending approvals, excluding expired ones', async () => {
    await approvalStore.create(approval());
    await approvalStore.create(approval({ entityType: 'site_signal', level: 'D' }));
    await approvalStore.create(
      approval({ expiresAt: new Date(Date.now() - 1000).toISOString() })
    );

    const pending = await approvalStore.findPending({});
    expect(pending).toHaveLength(2);
    expect(await approvalStore.findPending({ level: 'D' })).toHaveLength(1);
    expect(await approvalStore.findPending({ entityType: 'site_signal' })).toHaveLength(1);
  });

  it('auto-approves Level A through the service, persisted', async () => {
    const service = new ApprovalService(approvalStore);
    const a = await service.request({
      level: 'A',
      entityType: 'classification',
      entityId: generateId(),
      requestedByAgentId: 'site-autopilot',
    });

    expect(a.status).toBe('AUTO_APPROVED');
    expect((await approvalStore.findById(a.id))?.status).toBe('AUTO_APPROVED');
    // An auto-approved row is not pending work.
    expect(await approvalStore.findPending({})).toHaveLength(0);
  });

  it('holds Level C for a human through the service', async () => {
    const service = new ApprovalService(approvalStore);
    const a = await service.request({
      level: 'C',
      entityType: 'email_reply',
      entityId: generateId(),
      requestedByAgentId: 'site-autopilot',
    });

    expect(a.status).toBe('PENDING');
    const approved = await service.approve(a.id, 'fee', 'send it');
    expect(approved.status).toBe('APPROVED');
  });
});

// ─────────────────────────────────────────
// THE WHOLE LANE, ON POSTGRES
// ─────────────────────────────────────────

describe('AutopilotEngine on Postgres', () => {
  function buildEngine() {
    const email = new MockEmailConnector({
      email: 'contact@hutchrok.com',
      name: 'Hutchrok Solutions Group',
    });
    const events = new InMemoryEventPublisher();
    const engine = new AutopilotEngine({
      config: {
        identity: {
          address: 'contact@hutchrok.com',
          displayName: 'Hutchrok Solutions Group',
          teamInbox: 'contact@hutchrok.com',
          ownerInbox: 'ceo@hutchrok.com',
          siteUrl: 'https://hutchrok.com',
        },
        internalDomains: ['hutchrok.com'],
      },
      store,
      email,
      audit: new AuditService(new InMemoryAuditSink()),
      approvalStore,
      events,
      idempotency: receipts.keyClaimerFor(BINDING),
    });
    return { engine, email, events };
  }

  function inbound(overrides: Partial<InboundEmail> = {}): InboundEmail {
    return {
      providerMessageId: generateId(),
      internetMessageId: `<${generateId()}@example.invalid>`,
      references: [],
      from: 'applicant@example.invalid',
      to: ['contact@hutchrok.com'],
      cc: [],
      subject: 'Do I qualify for the free veteran LLC filing?',
      text: 'I am a Texas veteran and would like to form an LLC. Do I qualify?',
      headers: {},
      receivedAt: nowISO(),
      provider: 'test',
      ...overrides,
    };
  }

  it('creates a durable thread and draft from one inbound email', async () => {
    const { engine } = buildEngine();
    const run = await engine.handleInboundEmail(inbound());

    expect(run.duplicate).toBe(false);
    expect(run.threadId).toBeTruthy();

    // Everything survived the round trip through Postgres.
    const persisted = await store.getThread(run.threadId!);
    expect(persisted).not.toBeNull();
    expect(persisted?.contactEmail).toBe('applicant@example.invalid');
    expect(persisted?.messages.length).toBeGreaterThan(0);

    const rows = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM email_threads`
    );
    expect(rows.rows[0]?.n).toBe(1);
  });

  it('suppresses a redelivered email using the shared receipts table', async () => {
    const { engine } = buildEngine();
    const email = inbound();

    const first = await engine.handleInboundEmail(email);
    expect(first.duplicate).toBe(false);

    const second = await engine.handleInboundEmail(email);
    expect(second.duplicate).toBe(true);

    // One thread, and the dedupe record lives in provider_event_receipts —
    // not in a key set private to the autopilot store.
    const threads = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM email_threads`
    );
    expect(threads.rows[0]?.n).toBe(1);

    const receiptRows = await harness.client.query<{ n: number; replay: number }>(
      `SELECT count(*)::int AS n, max(replay_count)::int AS replay FROM provider_event_receipts`
    );
    expect(receiptRows.rows[0]?.n).toBe(1);
    expect(receiptRows.rows[0]?.replay).toBe(1);
  });

  it('routes a substantive reply to a persisted Level C approval and sends on approve', async () => {
    const { engine, email: connector } = buildEngine();
    await engine.handleInboundEmail(inbound());

    const pending = await store.listDrafts({ status: 'pending_approval' });
    expect(pending.length).toBeGreaterThan(0);

    const target = pending.find((d) => d.approvalId !== undefined);
    expect(target, 'expected a draft linked to an approval').toBeDefined();

    const stored = await approvalStore.findById(target!.approvalId!);
    expect(stored?.status).toBe('PENDING');
    expect(stored?.level).toBe('C');

    const sentBefore = connector.sent.length;
    await engine.approveDraft(target!.approvalId!, 'fee');

    // The provider was actually called, and the draft records the evidence.
    expect(connector.sent.length).toBe(sentBefore + 1);
    const after = await store.getDraft(target!.id);
    expect(after?.status).toBe('sent');
    expect(after?.providerMessageId).toBeTruthy();

    expect((await approvalStore.findById(target!.approvalId!))?.status).toBe('APPROVED');
  });

  it('honours suppression across a restart, since it is in the database', async () => {
    const { engine } = buildEngine();
    await engine.handleInboundEmail(
      inbound({ subject: 'unsubscribe', text: 'Please unsubscribe me.' })
    );

    expect(await store.isSuppressed('applicant@example.invalid')).toBe(true);

    // A brand-new engine over the same store still sees the suppression.
    const { engine: restarted } = buildEngine();
    const run = await restarted.handleInboundEmail(inbound());
    const acknowledgements = run.actions.filter(
      (a) => a.kind === 'acknowledge' && a.status === 'executed'
    );
    expect(acknowledgements).toHaveLength(0);
  });
});
