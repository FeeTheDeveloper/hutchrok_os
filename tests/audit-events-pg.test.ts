/**
 * PgAuditSink and PgEventStore against real Postgres (PGlite).
 *
 * CLAUDE.md treats audit logging as non-negotiable, so the tests here are
 * about the properties that make a trail trustworthy: it is append-only, a
 * replayed write cannot rewrite history, non-UUID entity ids are accepted
 * (they are what real callers pass), and the trail survives a restart.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { AuditService } from '@hutchrok-os/audit';
import { AutopilotEngine, type EventPublisher } from '@hutchrok-os/autopilot';
import { MockEmailConnector, type InboundEmail } from '@hutchrok-os/connectors';
import { ProviderReceiptService } from '@hutchrok-os/activity';
import {
  PgApprovalStore,
  PgAuditSink,
  PgAutopilotStore,
  PgEventStore,
  PgProviderReceiptStore,
} from '@hutchrok-os/db/stores';
import type { AuditLog } from '@hutchrok-os/domain';
import {
  createActivity,
  createEvent,
  isActivityEnvelope,
  type ActivityEnvelope,
} from '@hutchrok-os/events';
import { generateId, nowISO } from '@hutchrok-os/shared';

import { createTestDatabase, type TestDatabase } from './helpers/pg.js';

const BINDING = {
  tenantId: 'hutchrok-solutions-group',
  companyId: 'hutchrok-solutions-group',
};

let harness: TestDatabase;
let sink: PgAuditSink;
let events: PgEventStore;

beforeAll(async () => {
  harness = await createTestDatabase();
  sink = new PgAuditSink(harness.db);
  events = new PgEventStore(harness.db);
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.client.exec(`
    TRUNCATE email_messages, email_drafts, autopilot_tasks, email_threads,
             email_contacts, approvals, provider_event_receipts,
             audit_logs, events
    RESTART IDENTITY CASCADE;
  `);
});

function auditRecord(overrides: Partial<AuditLog> = {}): AuditLog {
  const now = nowISO();
  return {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    actor: 'site-autopilot',
    actorType: 'AGENT',
    actionType: 'autopilot.email.received',
    result: 'SUCCESS',
    correlationId: 'corr_audit',
    metadata: {},
    ...overrides,
  };
}

// ─────────────────────────────────────────
// AUDIT SINK
// ─────────────────────────────────────────

describe('PgAuditSink', () => {
  it('round-trips a record with every optional field populated', async () => {
    const record = auditRecord({
      entityType: 'email_thread',
      entityId: generateId(),
      before: { status: 'open' },
      after: { status: 'awaiting_team' },
      result: 'PARTIAL',
      errorMessage: 'provider degraded',
      causationId: 'caus_1',
      source: 'webhook:resend',
      ipAddress: '203.0.113.7',
      metadata: { intent: 'filing_question', findings: ['ssn'] },
    });
    await sink.append(record);

    const [found] = await sink.query({ correlationId: 'corr_audit' });
    expect(found?.id).toBe(record.id);
    expect(found?.actor).toBe('site-autopilot');
    expect(found?.actorType).toBe('AGENT');
    expect(found?.before).toEqual({ status: 'open' });
    expect(found?.after).toEqual({ status: 'awaiting_team' });
    expect(found?.result).toBe('PARTIAL');
    expect(found?.errorMessage).toBe('provider degraded');
    expect(found?.source).toBe('webhook:resend');
    expect(found?.ipAddress).toBe('203.0.113.7');
    expect(found?.metadata).toEqual({ intent: 'filing_question', findings: ['ssn'] });
  });

  it('leaves absent optionals undefined, and distinguishes them from empty', async () => {
    await sink.append(auditRecord());

    const [found] = await sink.query({});
    expect(found?.entityType).toBeUndefined();
    expect(found?.entityId).toBeUndefined();
    expect(found?.errorMessage).toBeUndefined();
    // `before`/`after` absent is meaningfully different from `{}`.
    expect(found?.before).toBeUndefined();
    expect(found?.after).toBeUndefined();
    // metadata always exists.
    expect(found?.metadata).toEqual({});
  });

  it('preserves an explicitly empty before/after', async () => {
    await sink.append(auditRecord({ before: {}, after: {} }));
    const [found] = await sink.query({});
    expect(found?.before).toEqual({});
    expect(found?.after).toEqual({});
  });

  it('accepts the non-UUID entity ids real callers pass', async () => {
    // Every one of these appears in packages/autopilot/src/engine.ts and
    // would have failed against the original uuid column.
    const ids = [
      'unsent',
      'applicant@example.invalid',
      'resend-email-id-not-a-uuid',
      'signal_abc123',
    ];

    for (const entityId of ids) {
      await sink.append(auditRecord({ entityId, entityType: 'notification' }));
    }

    const found = await sink.query({ entityType: 'notification' });
    expect(found).toHaveLength(ids.length);
    expect(found.map((r) => r.entityId).sort()).toEqual([...ids].sort());
  });

  it('is append-only: a replayed write is a no-op, not an overwrite', async () => {
    const record = auditRecord({ actionType: 'autopilot.draft.sent', result: 'SUCCESS' });
    await sink.append(record);

    // A retried handler re-appends the same id with tampered content.
    await sink.append({
      ...record,
      actionType: 'something.else',
      result: 'FAILURE',
      actor: 'attacker',
    });

    expect(await sink.count()).toBe(1);
    const [found] = await sink.query({});
    // History is unchanged.
    expect(found?.actionType).toBe('autopilot.draft.sent');
    expect(found?.result).toBe('SUCCESS');
    expect(found?.actor).toBe('site-autopilot');
  });

  it('filters by actor, action type, entity and correlation', async () => {
    await sink.append(auditRecord({ actor: 'fee', actorType: 'USER', actionType: 'approval.approved' }));
    await sink.append(auditRecord({ actionType: 'autopilot.email.received', entityId: 'e1' }));
    await sink.append(auditRecord({ correlationId: 'corr_other' }));

    expect(await sink.query({ actor: 'fee' })).toHaveLength(1);
    expect(await sink.query({ actionType: 'approval.approved' })).toHaveLength(1);
    expect(await sink.query({ entityId: 'e1' })).toHaveLength(1);
    expect(await sink.query({ correlationId: 'corr_other' })).toHaveLength(1);
    expect(await sink.query({})).toHaveLength(3);
  });

  it('filters by date range and returns newest first', async () => {
    await sink.append(auditRecord({ createdAt: '2026-01-01T00:00:00.000Z' }));
    await sink.append(auditRecord({ createdAt: '2026-06-01T00:00:00.000Z' }));
    await sink.append(auditRecord({ createdAt: '2026-12-01T00:00:00.000Z' }));

    const all = await sink.query({});
    expect(all[0]?.createdAt).toContain('2026-12-01');

    const windowed = await sink.query({
      fromDate: '2026-03-01T00:00:00.000Z',
      toDate: '2026-09-01T00:00:00.000Z',
    });
    expect(windowed).toHaveLength(1);
    expect(windowed[0]?.createdAt).toContain('2026-06-01');
  });

  it('honours the limit', async () => {
    for (let i = 0; i < 5; i++) await sink.append(auditRecord());
    expect(await sink.query({ limit: 2 })).toHaveLength(2);
  });

  it('records every actor type and result the domain allows', async () => {
    for (const actorType of ['USER', 'AGENT', 'SYSTEM', 'CONNECTOR'] as const) {
      await sink.append(auditRecord({ actorType }));
    }
    for (const result of ['SUCCESS', 'FAILURE', 'PARTIAL'] as const) {
      await sink.append(auditRecord({ result }));
    }
    expect(await sink.count()).toBe(7);
  });

  it('persists through the AuditService the engine actually uses', async () => {
    const service = new AuditService(sink);
    const written = await service.record({
      actor: 'site-autopilot',
      actorType: 'AGENT',
      actionType: 'autopilot.notify_team',
      entityType: 'notification',
      entityId: 'unsent',
      result: 'FAILURE',
      errorMessage: 'send failed',
    });

    const [found] = await service.query({ actionType: 'autopilot.notify_team' });
    expect(found?.id).toBe(written.id);
    expect(found?.entityId).toBe('unsent');
    expect(found?.result).toBe('FAILURE');
  });
});

// ─────────────────────────────────────────
// EVENT STORE
// ─────────────────────────────────────────

describe('PgEventStore', () => {
  it('round-trips a plain event', async () => {
    const event = createEvent({
      event_type: 'email.received',
      source: 'webhook:resend',
      actor: 'provider:resend',
      entity_type: 'email',
      entity_id: 'resend-id-not-a-uuid',
      payload: { subject: 'hello', nested: { ok: true } },
      metadata: { attempt: 1 },
      risk_level: 'MEDIUM',
    });
    await events.publish(event);

    const found = await events.findById(event.event_id);
    expect(found?.event_type).toBe('email.received');
    expect(found?.business_id).toBe('hutchrok-solutions-group');
    expect(found?.source).toBe('webhook:resend');
    expect(found?.entity_id).toBe('resend-id-not-a-uuid');
    expect(found?.payload).toEqual({ subject: 'hello', nested: { ok: true } });
    expect(found?.metadata).toEqual({ attempt: 1 });
    expect(found?.risk_level).toBe('MEDIUM');
    expect(found?.schema_version).toBe('1.0');
    expect(found?.correlation_id).toBe(event.correlation_id);
  });

  it('stores an ActivityEnvelope whole, tenant binding and classification included', async () => {
    const activity = createActivity({
      event_type: 'webhook.received',
      source: 'webhook:stripe',
      actor: 'provider:stripe',
      channel: 'internal',
      data_classification: 'CONFIDENTIAL',
      tenant_id: BINDING.tenantId,
      company_id: BINDING.companyId,
      provider: 'stripe',
      provider_event_id: 'evt_1',
      evidence_ref: 'receipt:abc',
    });
    await events.publish(activity);

    const found = await events.findById(activity.event_id);
    expect(found?.event_type).toBe('webhook.received');
    expect(found?.correlation_id).toBe(activity.correlation_id);

    // Reads back as an activity, not a lossy base event.
    expect(isActivityEnvelope(found!)).toBe(true);
    const asActivity = found as ActivityEnvelope;
    expect(asActivity.tenant_id).toBe(BINDING.tenantId);
    expect(asActivity.company_id).toBe(BINDING.companyId);
    expect(asActivity.channel).toBe('internal');
    expect(asActivity.data_classification).toBe('CONFIDENTIAL');
    expect(asActivity.provider).toBe('stripe');
    expect(asActivity.provider_event_id).toBe('evt_1');
    expect(asActivity.evidence_ref).toBe('receipt:abc');
  });

  it('leaves a plain event a plain event', async () => {
    const event = createEvent({
      event_type: 'customer.created',
      source: 'api',
      actor: 'user:fee',
    });
    await events.publish(event);

    const found = await events.findById(event.event_id);
    expect(found).not.toBeNull();
    expect(isActivityEnvelope(found!)).toBe(false);
  });

  it('isolates activities by tenant and filters by channel', async () => {
    for (const [tenant, channel] of [
      [BINDING.tenantId, 'email'],
      [BINDING.tenantId, 'sms'],
      ['other-portfolio-co', 'email'],
    ] as const) {
      await events.publish(
        createActivity({
          event_type: 'activity.received',
          source: 'test',
          actor: 'test',
          channel,
          tenant_id: tenant,
          company_id: tenant,
        })
      );
    }

    expect(await events.query({ tenantId: BINDING.tenantId })).toHaveLength(2);
    expect(await events.query({ tenantId: 'other-portfolio-co' })).toHaveLength(1);
    expect(await events.query({ tenantId: BINDING.tenantId, channel: 'sms' })).toHaveLength(1);
  });

  it('is append-only: republishing is a no-op', async () => {
    const event = createEvent({
      event_type: 'filing.submitted',
      source: 'api',
      actor: 'user:fee',
    });
    await events.publish(event);
    await events.publish({ ...event, event_type: 'filing.rejected', actor: 'attacker' });

    expect(await events.count()).toBe(1);
    const found = await events.findById(event.event_id);
    expect(found?.event_type).toBe('filing.submitted');
    expect(found?.actor).toBe('user:fee');
  });

  it('reconstructs one activity story by correlation id, oldest first', async () => {
    const correlationId = 'corr_story';
    const types = ['email.received', 'email.reply_drafted', 'email.reply_approved', 'email.sent'];

    for (const [i, event_type] of types.entries()) {
      await events.publish({
        ...createEvent({
          event_type,
          source: 'site-autopilot',
          actor: 'site-autopilot',
          correlation_id: correlationId,
        }),
        timestamp: new Date(Date.parse('2026-10-07T12:00:00.000Z') + i * 1000).toISOString(),
      });
    }

    const story = await events.byCorrelation(correlationId);
    expect(story.map((e) => e.event_type)).toEqual(types);
  });

  it('filters by type, actor, entity and date, newest first', async () => {
    await events.publish(
      createEvent({ event_type: 'filing.submitted', source: 'api', actor: 'user:fee' })
    );
    await events.publish(
      createEvent({
        event_type: 'email.sent',
        source: 'site-autopilot',
        actor: 'site-autopilot',
        entity_type: 'email_draft',
        entity_id: 'draft-1',
      })
    );

    expect(await events.query({ eventType: 'filing.submitted' })).toHaveLength(1);
    expect(await events.query({ actor: 'site-autopilot' })).toHaveLength(1);
    expect(await events.query({ entityId: 'draft-1' })).toHaveLength(1);
    expect(await events.query({ entityType: 'email_draft' })).toHaveLength(1);
    expect(await events.query({ limit: 1 })).toHaveLength(1);
    expect(await events.query({})).toHaveLength(2);
  });

  it('returns null for an unknown event', async () => {
    expect(await events.findById(generateId())).toBeNull();
  });
});

// ─────────────────────────────────────────
// THE TRAIL SURVIVES A RESTART
// ─────────────────────────────────────────

describe('audit trail durability', () => {
  function buildEngine(eventPublisher: EventPublisher) {
    const receipts = new ProviderReceiptService(new PgProviderReceiptStore(harness.db));
    return new AutopilotEngine({
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
      store: new PgAutopilotStore(harness.db, receipts.keyClaimerFor(BINDING)),
      email: new MockEmailConnector({
        email: 'contact@hutchrok.com',
        name: 'Hutchrok Solutions Group',
      }),
      audit: new AuditService(sink),
      approvalStore: new PgApprovalStore(harness.db),
      events: eventPublisher,
      idempotency: receipts.keyClaimerFor(BINDING),
    });
  }

  function inbound(): InboundEmail {
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
    };
  }

  it('writes a durable audit trail and event log for one inbound email', async () => {
    const engine = buildEngine(events);
    const run = await engine.handleInboundEmail(inbound());

    // The trail is in the database, not a process array.
    const auditRows = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_logs`
    );
    expect(auditRows.rows[0]!.n).toBeGreaterThan(0);

    const eventRows = await harness.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM events`
    );
    expect(eventRows.rows[0]!.n).toBeGreaterThan(0);

    // Everything from one inbound email shares a correlation id, so the story
    // is reconstructible after the fact.
    const trail = await sink.query({ correlationId: run.correlationId, limit: 100 });
    expect(trail.length).toBeGreaterThan(0);
    expect(trail.every((r) => r.correlationId === run.correlationId)).toBe(true);
  });

  it('keeps the trail readable by a freshly constructed sink', async () => {
    const engine = buildEngine(events);
    await engine.handleInboundEmail(inbound());

    const before = await sink.count();
    expect(before).toBeGreaterThan(0);

    // Simulate a restart: brand-new sink objects over the same database.
    const restartedSink = new PgAuditSink(harness.db);
    const restartedEvents = new PgEventStore(harness.db);

    expect(await restartedSink.count()).toBe(before);
    expect((await restartedEvents.query({})).length).toBeGreaterThan(0);
  });

  it('records the approval decision against the approver, durably', async () => {
    const engine = buildEngine(events);
    await engine.handleInboundEmail(inbound());

    const store = new PgAutopilotStore(
      harness.db,
      new ProviderReceiptService(new PgProviderReceiptStore(harness.db)).keyClaimerFor(BINDING)
    );
    const pending = await store.listDrafts({ status: 'pending_approval' });
    const target = pending.find((d) => d.approvalId !== undefined);
    expect(target).toBeDefined();

    await engine.approveDraft(target!.approvalId!, 'fee');

    // A human decision is attributable in the persisted trail.
    const byUser = await sink.query({ actor: 'fee', limit: 50 });
    expect(byUser.length).toBeGreaterThan(0);
    expect(byUser.every((r) => r.actorType === 'USER')).toBe(true);
  });
});
