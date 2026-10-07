/**
 * Postgres store adapters, exercised against real Postgres (PGlite).
 *
 * These are the tests that matter most for the activity kernel: the in-memory
 * stores can only approximate atomicity, while these run the committed
 * migration and the actual SQL. If `ON CONFLICT`/`xmax` or the
 * `FOR UPDATE SKIP LOCKED` claim regresses, it fails here.
 *
 * The suite also runs the *same* service-level assertions as the in-memory
 * tests, so both backends are held to one contract.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import {
  AssignmentService,
  ExceptionQueue,
  ProviderReceiptService,
  ScheduleService,
  hashPayload,
} from '@hutchrok-os/activity';
import {
  PgAssignmentStore,
  PgExceptionStore,
  PgProviderReceiptStore,
  PgScheduleStore,
} from '@hutchrok-os/db/stores';
import type { TenantBinding } from '@hutchrok-os/domain';

import { createTestDatabase, type TestDatabase } from './helpers/pg.js';

const BINDING: TenantBinding = {
  tenantId: 'hutchrok-solutions-group',
  companyId: 'hutchrok-solutions-group',
};

const OTHER_TENANT: TenantBinding = {
  tenantId: 'other-portfolio-co',
  companyId: 'other-portfolio-co',
};

let harness: TestDatabase;
let receipts: ProviderReceiptService;
let assignments: AssignmentService;
let exceptions: ExceptionQueue;
let schedules: ScheduleService;

beforeAll(async () => {
  harness = await createTestDatabase();
  receipts = new ProviderReceiptService(new PgProviderReceiptStore(harness.db));
  assignments = new AssignmentService(new PgAssignmentStore(harness.db));
  exceptions = new ExceptionQueue(new PgExceptionStore(harness.db));
  schedules = new ScheduleService(new PgScheduleStore(harness.db), { leaseMs: 60_000 });
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.client.exec(`
    TRUNCATE scheduled_actions, exception_queue, sla_records, assignments,
             provider_event_receipts RESTART IDENTITY CASCADE;
  `);
});

// ─────────────────────────────────────────
// MIGRATION
// ─────────────────────────────────────────

describe('committed migration', () => {
  it('applies cleanly and creates every activity kernel table', async () => {
    const res = await harness.client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    const tables = res.rows.map((r) => r.tablename);

    for (const expected of [
      'provider_event_receipts',
      'assignments',
      'exception_queue',
      'scheduled_actions',
      'sla_records',
      'credential_bindings',
      'contact_points',
      'consent_records',
      'attachment_evidence',
    ]) {
      expect(tables, `missing table ${expected}`).toContain(expected);
    }
  });

  it('creates the unique indexes that enforce idempotency in the database', async () => {
    const res = await harness.client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%_uq'`
    );
    const indexes = res.rows.map((r) => r.indexname);

    expect(indexes).toContain('provider_event_receipts_provider_event_uq');
    expect(indexes).toContain('scheduled_actions_tenant_idempotency_uq');
    expect(indexes).toContain('consent_records_point_channel_uq');
    expect(indexes).toContain('credential_bindings_scope_uq');
  });
});

// ─────────────────────────────────────────
// RECEIPTS — the atomicity that matters
// ─────────────────────────────────────────

describe('PgProviderReceiptStore', () => {
  const input = {
    ...BINDING,
    provider: 'stripe',
    providerEventId: 'evt_pg_1',
    rawBody: '{"id":"evt_pg_1"}',
    signatureVerified: true,
  };

  it('distinguishes the inserted row from the conflicting one', async () => {
    const first = await receipts.claim(input);
    expect(first.status).toBe('first_seen');
    expect(first.receipt.replayCount).toBe(0);

    const second = await receipts.claim(input);
    expect(second.status).toBe('replay');
    expect(second.receipt.replayCount).toBe(1);

    const third = await receipts.claim(input);
    expect(third.status).toBe('replay');
    expect(third.receipt.replayCount).toBe(2);

    const count = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM provider_event_receipts`
    );
    expect(count.rows[0]?.n).toBe(1);
  });

  it('tells exactly one of many concurrent deliveries that it may act', async () => {
    // Ten deliveries of the same provider event, issued together. This is the
    // race the unique index exists to settle.
    const claims = await Promise.all(
      Array.from({ length: 10 }, () => receipts.claim(input))
    );

    const firstSeen = claims.filter((c) => c.status === 'first_seen');
    expect(firstSeen).toHaveLength(1);
    expect(claims.filter((c) => c.status === 'replay')).toHaveLength(9);

    const count = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM provider_event_receipts`
    );
    expect(count.rows[0]?.n).toBe(1);
  });

  it('round-trips every field through Postgres unchanged', async () => {
    const claim = await receipts.claim(input);
    const found = await receipts.find('stripe', 'evt_pg_1');

    expect(found).not.toBeNull();
    expect(found?.id).toBe(claim.receipt.id);
    expect(found?.tenantId).toBe(BINDING.tenantId);
    expect(found?.companyId).toBe(BINDING.companyId);
    expect(found?.provider).toBe('stripe');
    expect(found?.idempotencyKey).toBe('stripe:evt_pg_1');
    expect(found?.payloadHash).toBe(hashPayload(input.rawBody));
    expect(found?.signatureVerified).toBe(true);
    // Timestamps come back as ISO strings, not Date objects.
    expect(found?.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(found?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it('keeps providers in separate namespaces', async () => {
    const a = await receipts.claim({ ...input, provider: 'stripe' });
    const b = await receipts.claim({ ...input, provider: 'github' });
    expect(a.status).toBe('first_seen');
    expect(b.status).toBe('first_seen');
  });

  it('links an activity id and reads it back as optional, not null', async () => {
    const claim = await receipts.claim(input);
    const before = await receipts.find('stripe', 'evt_pg_1');
    expect(before?.activityEventId).toBeUndefined();

    await receipts.linkActivity(claim.receipt.id, '11111111-1111-4111-8111-111111111111');
    const after = await receipts.find('stripe', 'evt_pg_1');
    expect(after?.activityEventId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('errors on linking an unknown receipt rather than silently doing nothing', async () => {
    await expect(
      receipts.linkActivity(
        '99999999-9999-4999-8999-999999999999',
        '88888888-8888-4888-8888-888888888888'
      )
    ).rejects.toThrow(/No receipt/);
  });

  it('rejects a malformed activity id, unlike the in-memory store', async () => {
    const claim = await receipts.claim(input);
    // The uuid column is a real constraint here; the in-memory store has none.
    await expect(receipts.linkActivity(claim.receipt.id, 'not-a-uuid')).rejects.toThrow(
      /uuid/i
    );
  });

  it('returns null for an event it has never seen', async () => {
    expect(await receipts.find('stripe', 'never-seen')).toBeNull();
  });
});

// ─────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────

function assignmentInput(overrides: Record<string, unknown> = {}) {
  return {
    ...BINDING,
    objective: 'Acknowledge the contact request and route it',
    triggeringEventId: '22222222-2222-4222-8222-222222222222',
    agentId: 'intake',
    controller: 'hutchrok-executive',
    lane: 'contact_consultation' as const,
    exceptionOwner: 'Manager',
    correlationId: 'corr_pg',
    ...overrides,
  };
}

describe('PgAssignmentStore', () => {
  it('round-trips the full Section 6 contract', async () => {
    const created = await assignments.create(
      assignmentInput({
        inputs: { threadId: 'thread-1', nested: { ok: true } },
        allowedCapabilities: ['communications.send_email'],
        exclusions: ['filing.advance'],
        credentialScope: ['hutchrok:resend'],
        acceptanceCriteria: ['customer acknowledged'],
        evidenceRequired: ['provider_message_id'],
        dependencies: ['33333333-3333-4333-8333-333333333333'],
        handoffTarget: 'client-success',
        approvalLevel: 'C',
        classification: 'CONFIDENTIAL',
        retryPolicy: { maxAttempts: 5, backoffMs: 1000 },
      })
    );

    const found = await assignments.get(created.id);
    expect(found).not.toBeNull();
    expect(found?.objective).toBe(created.objective);
    expect(found?.inputs).toEqual({ threadId: 'thread-1', nested: { ok: true } });
    expect(found?.allowedCapabilities).toEqual(['communications.send_email']);
    expect(found?.exclusions).toEqual(['filing.advance']);
    expect(found?.credentialScope).toEqual(['hutchrok:resend']);
    expect(found?.acceptanceCriteria).toEqual(['customer acknowledged']);
    expect(found?.evidenceRequired).toEqual(['provider_message_id']);
    expect(found?.dependencies).toEqual(['33333333-3333-4333-8333-333333333333']);
    expect(found?.handoffTarget).toBe('client-success');
    expect(found?.approvalLevel).toBe('C');
    expect(found?.classification).toBe('CONFIDENTIAL');
    expect(found?.retryPolicy).toEqual({ maxAttempts: 5, backoffMs: 1000 });
    expect(found?.status).toBe('PENDING');
  });

  it('leaves optional columns undefined rather than null', async () => {
    const created = await assignments.create(assignmentInput());
    const found = await assignments.get(created.id);
    expect(found?.slaId).toBeUndefined();
    expect(found?.handoffTarget).toBeUndefined();
  });

  it('enforces the evidence gate through the database round trip', async () => {
    const a = await assignments.create(
      assignmentInput({ evidenceRequired: ['provider_message_id'] })
    );
    await assignments.start(a.id);

    await expect(assignments.complete(a.id, [])).rejects.toThrow(/missing evidence/i);

    const done = await assignments.complete(a.id, ['provider_message_id:msg_1']);
    expect(done.status).toBe('COMPLETED');

    const persisted = await assignments.get(a.id);
    expect(persisted?.evidenceRefs).toContain('provider_message_id:msg_1');
  });

  it('refuses a transition from the wrong state', async () => {
    const a = await assignments.create(assignmentInput());
    // Never started.
    await expect(assignments.complete(a.id, [])).rejects.toThrow(/not IN_PROGRESS/i);
  });

  it('lets exactly one of two racing completions win', async () => {
    const a = await assignments.create(assignmentInput());
    await assignments.start(a.id);

    const results = await Promise.allSettled([
      assignments.complete(a.id, []),
      assignments.complete(a.id, []),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('merges metadata on transition instead of replacing it', async () => {
    const a = await assignments.create(
      assignmentInput({ metadata: { origin: 'webhook' } })
    );
    await assignments.start(a.id);
    await assignments.block(a.id, 'provider down');

    const found = await assignments.get(a.id);
    expect(found?.metadata['origin']).toBe('webhook');
    expect(found?.metadata['blockedReason']).toBe('provider down');
  });

  it('counts attempts across restarts', async () => {
    const a = await assignments.create(
      assignmentInput({ retryPolicy: { maxAttempts: 2, backoffMs: 0 } })
    );
    const first = await assignments.start(a.id);
    expect(first.attempts).toBe(1);

    await assignments.block(a.id, 'retry');
    const second = await assignments.start(a.id);
    expect(second.attempts).toBe(2);
    expect(assignments.retriesExhausted(second)).toBe(true);
  });

  it('isolates tenants when listing', async () => {
    await assignments.create(assignmentInput());
    await assignments.create(assignmentInput({ ...OTHER_TENANT }));

    const mine = await assignments.list({ tenantId: BINDING.tenantId });
    expect(mine).toHaveLength(1);
    expect(mine[0]?.tenantId).toBe(BINDING.tenantId);

    const all = await assignments.list();
    expect(all).toHaveLength(2);
  });

  it('filters by lane and agent', async () => {
    await assignments.create(assignmentInput({ lane: 'free_filing', agentId: 'filing' }));
    await assignments.create(assignmentInput());

    expect(await assignments.list({ lane: 'free_filing' })).toHaveLength(1);
    expect(await assignments.list({ agentId: 'filing' })).toHaveLength(1);
    expect(await assignments.list({ status: 'PENDING' })).toHaveLength(2);
  });
});

// ─────────────────────────────────────────
// EXCEPTION QUEUE
// ─────────────────────────────────────────

describe('PgExceptionStore', () => {
  function raiseInput(overrides: Record<string, unknown> = {}) {
    return {
      ...BINDING,
      reason: 'PROVIDER_FAILURE' as const,
      summary: 'Resend returned 500 on send',
      ownerRole: 'Manager',
      correlationId: 'corr_pg',
      ...overrides,
    };
  }

  it('round-trips an item and reads optional columns as undefined', async () => {
    const item = await exceptions.raise(raiseInput({ evidenceRefs: ['receipt:abc'] }));

    const [found] = await exceptions.list({ status: 'OPEN' });
    expect(found?.id).toBe(item.id);
    expect(found?.reason).toBe('PROVIDER_FAILURE');
    expect(found?.severity).toBe('MEDIUM');
    expect(found?.evidenceRefs).toEqual(['receipt:abc']);
    expect(found?.detail).toBeUndefined();
    expect(found?.resolvedAt).toBeUndefined();
  });

  it('acknowledges then resolves, persisting who and when', async () => {
    const item = await exceptions.raise(raiseInput());

    await exceptions.acknowledge(item.id, 'fee');
    await exceptions.resolve(item.id, 'fee', 'Resent after provider recovered');

    const [resolved] = await exceptions.list({ status: 'RESOLVED' });
    expect(resolved?.resolvedBy).toBe('fee');
    expect(resolved?.resolution).toBe('Resent after provider recovered');
    expect(resolved?.acknowledgedBy).toBe('fee');
    expect(resolved?.acknowledgedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(await exceptions.open()).toHaveLength(0);
  });

  it('cannot be resolved twice, even under a race', async () => {
    const item = await exceptions.raise(raiseInput());

    const results = await Promise.allSettled([
      exceptions.resolve(item.id, 'fee', 'first'),
      exceptions.resolve(item.id, 'fee', 'second'),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('still refuses an agent identity when persisted', async () => {
    const item = await exceptions.raise(raiseInput());
    await expect(exceptions.resolve(item.id, 'claude-engineering', 'done')).rejects.toThrow(
      /only a human/i
    );
    expect(await exceptions.open()).toHaveLength(1);
  });

  it('dead-letters with raised severity', async () => {
    const item = await exceptions.raise(raiseInput());
    await exceptions.deadLetter(item.id, 'retries exhausted');

    const [dead] = await exceptions.list({ status: 'DEAD_LETTER' });
    expect(dead?.severity).toBe('HIGH');
    expect(dead?.detail).toBe('retries exhausted');
  });

  it('links an exception to its assignment', async () => {
    const a = await assignments.create(assignmentInput());
    const item = await exceptions.raise(raiseInput({ assignmentId: a.id }));

    const [found] = await exceptions.list({ status: 'OPEN' });
    expect(found?.id).toBe(item.id);
    expect(found?.assignmentId).toBe(a.id);
  });

  it('filters by owner role and reason', async () => {
    await exceptions.raise(raiseInput());
    await exceptions.raise(
      raiseInput({ ownerRole: 'Owner', reason: 'APPROVAL_REQUIRED' })
    );

    expect(await exceptions.list({ ownerRole: 'Owner' })).toHaveLength(1);
    expect(await exceptions.list({ reason: 'APPROVAL_REQUIRED' })).toHaveLength(1);
    expect(await exceptions.list({})).toHaveLength(2);
  });
});

// ─────────────────────────────────────────
// SCHEDULES — single-claim under contention
// ─────────────────────────────────────────

describe('PgScheduleStore', () => {
  function scheduleInput(overrides: Record<string, unknown> = {}) {
    return {
      ...BINDING,
      kind: 'follow_up',
      dueAt: new Date(Date.now() - 1000).toISOString(),
      idempotencyKey: 'followup:thread-1',
      correlationId: 'corr_pg',
      ...overrides,
    };
  }

  it('collapses a duplicate schedule onto the existing row', async () => {
    const first = await schedules.schedule(scheduleInput());
    expect(first.created).toBe(true);

    const second = await schedules.schedule(scheduleInput());
    expect(second.created).toBe(false);
    expect(second.action.id).toBe(first.action.id);

    expect(await schedules.list()).toHaveLength(1);
  });

  it('collapses duplicates even when requested concurrently', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => schedules.schedule(scheduleInput()))
    );

    expect(results.filter((r) => r.created)).toHaveLength(1);
    const ids = new Set(results.map((r) => r.action.id));
    expect(ids.size).toBe(1);
    expect(await schedules.list()).toHaveLength(1);
  });

  it('scopes the idempotency key per tenant', async () => {
    await schedules.schedule(scheduleInput());
    const other = await schedules.schedule(scheduleInput({ ...OTHER_TENANT }));
    expect(other.created).toBe(true);
    expect(await schedules.list()).toHaveLength(2);
  });

  it('hands a due action to one worker and leaves the others nothing', async () => {
    await schedules.schedule(scheduleInput());

    const a = await schedules.claimDue('worker-a');
    expect(a).toHaveLength(1);
    expect(a[0]?.lockedBy).toBe('worker-a');
    expect(a[0]?.lockedUntil).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);

    const b = await schedules.claimDue('worker-b');
    expect(b).toHaveLength(0);
  });

  it('does not claim an action before it is due', async () => {
    await schedules.schedule(
      scheduleInput({ dueAt: new Date(Date.now() + 3_600_000).toISOString() })
    );
    expect(await schedules.claimDue('worker-a')).toHaveLength(0);
  });

  it('respects the claim limit and due order', async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await schedules.schedule(
        scheduleInput({
          idempotencyKey: `followup:thread-${i}`,
          dueAt: new Date(now - (10 - i) * 1000).toISOString(),
        })
      );
    }

    const claimed = await schedules.claimDue('worker-a', 2);
    expect(claimed).toHaveLength(2);
    // Oldest due first.
    expect(claimed[0]?.idempotencyKey).toBe('followup:thread-0');
    expect(claimed[1]?.idempotencyKey).toBe('followup:thread-1');
  });

  it('refuses completion by a worker that does not hold the lease', async () => {
    await schedules.schedule(scheduleInput());
    const [claimed] = await schedules.claimDue('worker-a');

    await expect(schedules.complete(claimed!.id, 'worker-b')).rejects.toThrow(/leased to/i);

    const done = await schedules.complete(claimed!.id, 'worker-a');
    expect(done.status).toBe('COMPLETED');
    expect(done.lockedBy).toBeUndefined();
    expect(done.lockedUntil).toBeUndefined();
  });

  it('releases the lease on completion so nothing re-claims the row', async () => {
    await schedules.schedule(scheduleInput());
    const [claimed] = await schedules.claimDue('worker-a');
    await schedules.complete(claimed!.id, 'worker-a');

    expect(await schedules.claimDue('worker-b')).toHaveLength(0);
  });

  it('returns a failure to PENDING until the retry budget is spent', async () => {
    await schedules.schedule(scheduleInput({ maxAttempts: 2 }));

    const [first] = await schedules.claimDue('worker-a');
    const attempt1 = await schedules.fail(first!.id, 'worker-a', 'provider timeout');
    expect(attempt1.exhausted).toBe(false);
    expect(attempt1.action.status).toBe('PENDING');
    expect(attempt1.action.attempts).toBe(1);
    expect(attempt1.action.lockedBy).toBeUndefined();

    const [second] = await schedules.claimDue('worker-a');
    expect(second).toBeDefined();
    const attempt2 = await schedules.fail(second!.id, 'worker-a', 'provider timeout');
    expect(attempt2.exhausted).toBe(true);
    expect(attempt2.action.status).toBe('FAILED');
    expect(attempt2.action.lastError).toBe('provider timeout');

    expect(await schedules.claimDue('worker-a')).toHaveLength(0);
  });

  it('re-claims an action whose lease has expired', async () => {
    const short = new ScheduleService(new PgScheduleStore(harness.db), { leaseMs: -1000 });
    await short.schedule(scheduleInput());

    const a = await short.claimDue('worker-a');
    expect(a).toHaveLength(1);

    // The lease was already in the past, so another worker may take over.
    const b = await short.claimDue('worker-b');
    expect(b).toHaveLength(1);
    expect(b[0]?.lockedBy).toBe('worker-b');
  });

  it('cancels a pending action', async () => {
    const { action } = await schedules.schedule(scheduleInput());
    const cancelled = await schedules.cancel(action.id, 'thread closed');
    expect(cancelled.status).toBe('CANCELLED');
    expect(await schedules.claimDue('worker-a')).toHaveLength(0);
  });

  it('round-trips payload and metadata through jsonb', async () => {
    const { action } = await schedules.schedule(
      scheduleInput({
        payload: { threadId: 'thread-1', attempt: 2, nested: { deep: ['a', 'b'] } },
        metadata: { origin: 'beat' },
      })
    );

    const found = await schedules.list({ kind: 'follow_up' });
    expect(found[0]?.id).toBe(action.id);
    expect(found[0]?.payload).toEqual({
      threadId: 'thread-1',
      attempt: 2,
      nested: { deep: ['a', 'b'] },
    });
    expect(found[0]?.metadata).toEqual({ origin: 'beat' });
  });

  it('filters by status, kind and tenant', async () => {
    await schedules.schedule(scheduleInput());
    await schedules.schedule(
      scheduleInput({ kind: 'deadline', idempotencyKey: 'deadline:1' })
    );

    expect(await schedules.list({ kind: 'deadline' })).toHaveLength(1);
    expect(await schedules.list({ status: 'PENDING' })).toHaveLength(2);
    expect(await schedules.list({ tenantId: BINDING.tenantId })).toHaveLength(2);
    expect(await schedules.list({ tenantId: OTHER_TENANT.tenantId })).toHaveLength(0);
  });
});

// ─────────────────────────────────────────
// ONE IDEMPOTENCY MECHANISM
// ─────────────────────────────────────────

describe('receipt-backed key claimer', () => {
  it('gives the autopilot lane the same dedupe record as every webhook', async () => {
    const claimer = receipts.keyClaimerFor(BINDING);

    expect(await claimer.claimKey('email:message-id-1')).toBe(true);
    expect(await claimer.claimKey('email:message-id-1')).toBe(false);

    // The claim landed in the shared receipts table, not a separate key set.
    const row = await receipts.find('email', 'message-id-1');
    expect(row).not.toBeNull();
    expect(row?.idempotencyKey).toBe('email:message-id-1');
    expect(row?.replayCount).toBe(1);
  });

  it('keeps site signals and inbound email in separate namespaces', async () => {
    const claimer = receipts.keyClaimerFor(BINDING);
    expect(await claimer.claimKey('signal:abc')).toBe(true);
    expect(await claimer.claimKey('email:abc')).toBe(true);
  });

  it('rejects a malformed key rather than claiming nothing', async () => {
    const claimer = receipts.keyClaimerFor(BINDING);
    await expect(claimer.claimKey('nocolon')).rejects.toThrow(/Malformed idempotency key/);
  });
});
