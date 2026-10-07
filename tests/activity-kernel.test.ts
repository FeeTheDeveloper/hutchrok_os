/**
 * Activity kernel — receipts, assignments, exception queue, schedules.
 *
 * These cover the handoff's Section 16 "Required Tests" for P1: idempotency,
 * SLA/retry state, agent capability authorization, and the invariant that an
 * agent cannot assert completion without evidence.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  AssignmentService,
  ExceptionQueue,
  InMemoryAssignmentStore,
  InMemoryExceptionStore,
  InMemoryProviderReceiptStore,
  InMemoryScheduleStore,
  ProviderReceiptService,
  ScheduleService,
  hashPayload,
  idempotencyKeyFor,
  isWithinReplayWindow,
} from '@hutchrok-os/activity';
import {
  AssignmentSchema,
  CredentialBindingSchema,
  looksLikeSecretMaterial,
  type TenantBinding,
} from '@hutchrok-os/domain';
import {
  ActivityEnvelopeSchema,
  createActivity,
  isModelPermitted,
  isActivityEnvelope,
  createEvent,
} from '@hutchrok-os/events';

const BINDING: TenantBinding = {
  tenantId: 'hutchrok-solutions-group',
  companyId: 'hutchrok-solutions-group',
};

const OTHER_TENANT: TenantBinding = {
  tenantId: 'other-portfolio-co',
  companyId: 'other-portfolio-co',
};

// ─────────────────────────────────────────
// ACTIVITY ENVELOPE
// ─────────────────────────────────────────

describe('ActivityEnvelope', () => {
  it('normalizes an inbound signal with its tenant binding and classification', () => {
    const activity = createActivity({
      event_type: 'site.contact.submitted',
      source: 'webhook:website',
      actor: 'provider:website',
      channel: 'website',
      data_classification: 'CONFIDENTIAL',
      tenant_id: BINDING.tenantId,
      company_id: BINDING.companyId,
      provider: 'website',
      provider_event_id: 'form-123',
    });

    expect(activity.tenant_id).toBe(BINDING.tenantId);
    expect(activity.company_id).toBe(BINDING.companyId);
    expect(activity.channel).toBe('website');
    expect(activity.data_classification).toBe('CONFIDENTIAL');
    expect(activity.provider_event_id).toBe('form-123');
    expect(ActivityEnvelopeSchema.safeParse(activity).success).toBe(true);
  });

  it('refuses to normalize without a resolved tenant/company binding', () => {
    expect(() =>
      createActivity({
        event_type: 'site.contact.submitted',
        source: 'webhook:website',
        actor: 'provider:website',
        channel: 'website',
        tenant_id: '',
        company_id: BINDING.companyId,
      })
    ).toThrow(/tenant\/company binding/i);
  });

  it('remains a valid EventEnvelope, so existing consumers keep working', () => {
    const activity = createActivity({
      event_type: 'email.received',
      source: 'webhook:resend',
      actor: 'provider:resend',
      channel: 'email',
      tenant_id: BINDING.tenantId,
      company_id: BINDING.companyId,
    });

    // Fields every existing consumer reads.
    expect(activity.event_id).toBeTruthy();
    expect(activity.correlation_id).toBeTruthy();
    expect(activity.business_id).toBe('hutchrok-solutions-group');
    expect(activity.schema_version).toBe('1.0');
  });

  it('does not mistake a plain event for an activity', () => {
    const plain = createEvent({
      event_type: 'customer.created',
      source: 'api',
      actor: 'user:test',
    });
    expect(isActivityEnvelope(plain)).toBe(false);
  });

  it('blocks RESTRICTED and SECRET from model exposure', () => {
    expect(isModelPermitted('PUBLIC')).toBe(true);
    expect(isModelPermitted('INTERNAL')).toBe(true);
    expect(isModelPermitted('CONFIDENTIAL')).toBe(true);
    expect(isModelPermitted('RESTRICTED')).toBe(false);
    expect(isModelPermitted('SECRET')).toBe(false);
  });
});

// ─────────────────────────────────────────
// PROVIDER RECEIPTS / IDEMPOTENCY
// ─────────────────────────────────────────

describe('ProviderReceiptService', () => {
  let receipts: ProviderReceiptService;
  let store: InMemoryProviderReceiptStore;

  beforeEach(() => {
    store = new InMemoryProviderReceiptStore();
    receipts = new ProviderReceiptService(store);
  });

  it('accepts the first delivery and marks every repeat a replay', async () => {
    const input = {
      ...BINDING,
      provider: 'stripe',
      providerEventId: 'evt_123',
      rawBody: '{"id":"evt_123"}',
      signatureVerified: true,
    };

    const first = await receipts.claim(input);
    expect(first.status).toBe('first_seen');
    expect(first.receipt.replayCount).toBe(0);

    const second = await receipts.claim(input);
    expect(second.status).toBe('replay');
    expect(second.receipt.replayCount).toBe(1);

    const third = await receipts.claim(input);
    expect(third.status).toBe('replay');
    expect(third.receipt.replayCount).toBe(2);

    // Only one receipt row ever existed for this provider event.
    expect(store.all()).toHaveLength(1);
  });

  it('treats the same event id from different providers as distinct', async () => {
    const a = await receipts.claim({
      ...BINDING,
      provider: 'stripe',
      providerEventId: 'shared-id',
      rawBody: 'a',
      signatureVerified: true,
    });
    const b = await receipts.claim({
      ...BINDING,
      provider: 'github',
      providerEventId: 'shared-id',
      rawBody: 'b',
      signatureVerified: true,
    });

    expect(a.status).toBe('first_seen');
    expect(b.status).toBe('first_seen');
  });

  it('hashes the payload rather than storing it', async () => {
    const rawBody = '{"ssn":"000-00-0000"}';
    const claim = await receipts.claim({
      ...BINDING,
      provider: 'website',
      providerEventId: 'f1',
      rawBody,
      signatureVerified: true,
    });

    expect(claim.receipt.payloadHash).toBe(hashPayload(rawBody));
    expect(JSON.stringify(claim.receipt)).not.toContain('000-00-0000');
  });

  it('refuses a receipt without a resolved tenant binding', async () => {
    await expect(
      receipts.claim({
        tenantId: '',
        companyId: '',
        provider: 'stripe',
        providerEventId: 'evt_1',
        rawBody: '{}',
        signatureVerified: true,
      })
    ).rejects.toThrow(/tenant\/company binding/i);
  });

  it('exposes claimKey with the same contract the email lane already uses', async () => {
    const key = idempotencyKeyFor('email', 'message-id-1');
    expect(await receipts.claimKey(key, BINDING)).toBe(true);
    expect(await receipts.claimKey(key, BINDING)).toBe(false);
  });

  it('links the activity it produced, for the audit trail', async () => {
    const claim = await receipts.claim({
      ...BINDING,
      provider: 'stripe',
      providerEventId: 'evt_link',
      rawBody: '{}',
      signatureVerified: true,
    });
    await receipts.linkActivity(claim.receipt.id, '11111111-1111-4111-8111-111111111111');

    const found = await receipts.find('stripe', 'evt_link');
    expect(found?.activityEventId).toBe('11111111-1111-4111-8111-111111111111');
  });
});

describe('replay window', () => {
  const now = Date.parse('2026-10-07T12:00:00.000Z');

  it('accepts a fresh delivery', () => {
    expect(isWithinReplayWindow('2026-10-07T11:58:00.000Z', 300_000, now)).toBe(true);
  });

  it('rejects a delivery older than the window', () => {
    expect(isWithinReplayWindow('2026-10-07T11:50:00.000Z', 300_000, now)).toBe(false);
  });

  it('rejects a timestamp implausibly far in the future', () => {
    expect(isWithinReplayWindow('2026-10-07T12:10:00.000Z', 300_000, now)).toBe(false);
  });

  it('rejects an unparseable timestamp', () => {
    expect(isWithinReplayWindow('not-a-date', 300_000, now)).toBe(false);
  });
});

// ─────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────

function assignmentInput(overrides: Partial<Parameters<AssignmentService['create']>[0]> = {}) {
  return {
    ...BINDING,
    objective: 'Acknowledge the contact request and route it',
    triggeringEventId: '22222222-2222-4222-8222-222222222222',
    agentId: 'intake',
    controller: 'hutchrok-executive',
    lane: 'contact_consultation' as const,
    exceptionOwner: 'Manager',
    correlationId: 'corr_test',
    ...overrides,
  };
}

describe('AssignmentService', () => {
  let service: AssignmentService;

  beforeEach(() => {
    service = new AssignmentService(new InMemoryAssignmentStore());
  });

  it('creates an assignment with exactly one accountable agent', async () => {
    const a = await service.create(assignmentInput());
    expect(a.agentId).toBe('intake');
    expect(a.status).toBe('PENDING');
    expect(AssignmentSchema.safeParse(a).success).toBe(true);
  });

  it('refuses without a resolved tenant binding', async () => {
    await expect(
      service.create(assignmentInput({ tenantId: '', companyId: '' }))
    ).rejects.toThrow(/tenant\/company binding/i);
  });

  it('refuses a capability that is both allowed and excluded', async () => {
    await expect(
      service.create(
        assignmentInput({
          allowedCapabilities: ['communications.send_email'],
          exclusions: ['communications.send_email'],
        })
      )
    ).rejects.toThrow(/both allowed and excluded/i);
  });

  it('authorizes only listed capabilities, and exclusions win', async () => {
    const a = await service.create(
      assignmentInput({
        allowedCapabilities: ['communications.send_email', 'customers.create'],
        exclusions: ['filing.advance'],
      })
    );

    expect(service.authorizeCapability(a, 'communications.send_email')).toBe(true);
    expect(service.authorizeCapability(a, 'customers.create')).toBe(true);
    // Not on the allow-list.
    expect(service.authorizeCapability(a, 'payments.request_refund')).toBe(false);
    // Explicitly excluded.
    expect(service.authorizeCapability(a, 'filing.advance')).toBe(false);
  });

  it('grants nothing when the allow-list is empty', async () => {
    const a = await service.create(assignmentInput());
    expect(service.authorizeCapability(a, 'communications.send_email')).toBe(false);
  });

  it('denies a credential scope it was not granted', async () => {
    const a = await service.create(
      assignmentInput({ credentialScope: ['hutchrok:resend'] })
    );
    expect(service.authorizeCredential(a, 'hutchrok:resend')).toBe(true);
    expect(service.authorizeCredential(a, 'other-portfolio-co:resend')).toBe(false);
  });

  it('cannot complete without the evidence it declared it would need', async () => {
    const a = await service.create(
      assignmentInput({ evidenceRequired: ['provider_message_id'] })
    );
    await service.start(a.id);

    await expect(service.complete(a.id, [])).rejects.toThrow(/missing evidence/i);
    await expect(service.complete(a.id, ['screenshot:abc'])).rejects.toThrow(
      /missing evidence/i
    );

    const done = await service.complete(a.id, ['provider_message_id:msg_123']);
    expect(done.status).toBe('COMPLETED');
    expect(done.evidenceRefs).toContain('provider_message_id:msg_123');
  });

  it('completes freely when no evidence was required', async () => {
    const a = await service.create(assignmentInput());
    await service.start(a.id);
    const done = await service.complete(a.id, []);
    expect(done.status).toBe('COMPLETED');
  });

  it('counts attempts and reports an exhausted retry budget', async () => {
    const a = await service.create(
      assignmentInput({ retryPolicy: { maxAttempts: 2, backoffMs: 0 } })
    );

    const first = await service.start(a.id);
    expect(first.attempts).toBe(1);
    expect(service.retriesExhausted(first)).toBe(false);

    await service.block(a.id, 'provider down');
    const second = await service.start(a.id);
    expect(second.attempts).toBe(2);
    expect(service.retriesExhausted(second)).toBe(true);
  });

  it('will not complete an assignment that never started', async () => {
    const a = await service.create(assignmentInput());
    await expect(service.complete(a.id, [])).rejects.toThrow(/not IN_PROGRESS/i);
  });

  it('isolates assignments by tenant when listing', async () => {
    await service.create(assignmentInput());
    await service.create(assignmentInput({ ...OTHER_TENANT }));

    const mine = await service.list({ tenantId: BINDING.tenantId });
    expect(mine).toHaveLength(1);
    expect(mine[0]?.tenantId).toBe(BINDING.tenantId);
  });
});

// ─────────────────────────────────────────
// EXCEPTION QUEUE
// ─────────────────────────────────────────

describe('ExceptionQueue', () => {
  let queue: ExceptionQueue;

  function raiseInput(overrides: Record<string, unknown> = {}) {
    return {
      ...BINDING,
      reason: 'PROVIDER_FAILURE' as const,
      summary: 'Resend returned 500 on send',
      ownerRole: 'Manager',
      correlationId: 'corr_test',
      ...overrides,
    };
  }

  beforeEach(() => {
    queue = new ExceptionQueue(new InMemoryExceptionStore());
  });

  it('raises a visible OPEN item rather than reporting success', async () => {
    const item = await queue.raise(raiseInput());
    expect(item.status).toBe('OPEN');

    const open = await queue.open();
    expect(open).toHaveLength(1);
    expect(open[0]?.reason).toBe('PROVIDER_FAILURE');
  });

  it('refuses to raise without a resolved tenant binding', async () => {
    await expect(queue.raise(raiseInput({ tenantId: '', companyId: '' }))).rejects.toThrow(
      /tenant\/company binding/i
    );
  });

  it('lets a human acknowledge then resolve with a stated resolution', async () => {
    const item = await queue.raise(raiseInput());

    const ack = await queue.acknowledge(item.id, 'fee');
    expect(ack.status).toBe('ACKNOWLEDGED');
    expect(ack.acknowledgedBy).toBe('fee');

    const resolved = await queue.resolve(item.id, 'fee', 'Resent after provider recovered');
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolution).toBe('Resent after provider recovered');
  });

  it('will not let an agent clear its own exception', async () => {
    const item = await queue.raise(raiseInput());

    await expect(queue.acknowledge(item.id, 'claude-engineering')).rejects.toThrow(
      /only a human/i
    );
    await expect(queue.resolve(item.id, 'site-autopilot', 'done')).rejects.toThrow(
      /only a human/i
    );
    await expect(queue.resolve(item.id, 'agent:intake', 'done')).rejects.toThrow(
      /only a human/i
    );

    // Still open — nothing was cleared.
    expect(await queue.open()).toHaveLength(1);
  });

  it('requires a stated resolution to close an item', async () => {
    const item = await queue.raise(raiseInput());
    await expect(queue.resolve(item.id, 'fee', '   ')).rejects.toThrow(/stated resolution/i);
  });

  it('refuses to acknowledge without an identified user', async () => {
    const item = await queue.raise(raiseInput());
    await expect(queue.acknowledge(item.id, '')).rejects.toThrow(/identified user/i);
  });

  it('dead-letters an exhausted item but keeps it visible', async () => {
    const item = await queue.raise(raiseInput());
    const dead = await queue.deadLetter(item.id, 'retries exhausted after 3 attempts');

    expect(dead.status).toBe('DEAD_LETTER');
    expect(dead.severity).toBe('HIGH');

    const listed = await queue.list({ status: 'DEAD_LETTER' });
    expect(listed).toHaveLength(1);
  });

  it('cannot resolve an item twice', async () => {
    const item = await queue.raise(raiseInput());
    await queue.resolve(item.id, 'fee', 'fixed');
    await expect(queue.resolve(item.id, 'fee', 'again')).rejects.toThrow(
      /not OPEN or ACKNOWLEDGED/i
    );
  });
});

// ─────────────────────────────────────────
// SCHEDULES
// ─────────────────────────────────────────

describe('ScheduleService', () => {
  let service: ScheduleService;

  function scheduleInput(overrides: Record<string, unknown> = {}) {
    return {
      ...BINDING,
      kind: 'follow_up',
      dueAt: new Date(Date.now() - 1000).toISOString(),
      idempotencyKey: 'followup:thread-1',
      correlationId: 'corr_test',
      ...overrides,
    };
  }

  beforeEach(() => {
    service = new ScheduleService(new InMemoryScheduleStore(), { leaseMs: 60_000 });
  });

  it('does not queue the same logical follow-up twice', async () => {
    const first = await service.schedule(scheduleInput());
    expect(first.created).toBe(true);

    const second = await service.schedule(scheduleInput());
    expect(second.created).toBe(false);
    expect(second.action.id).toBe(first.action.id);

    expect(await service.list()).toHaveLength(1);
  });

  it('scopes the idempotency key per tenant', async () => {
    await service.schedule(scheduleInput());
    const other = await service.schedule(scheduleInput({ ...OTHER_TENANT }));
    expect(other.created).toBe(true);
    expect(await service.list()).toHaveLength(2);
  });

  it('lets only one worker claim a due action', async () => {
    await service.schedule(scheduleInput());

    const workerA = await service.claimDue('worker-a');
    expect(workerA).toHaveLength(1);
    expect(workerA[0]?.lockedBy).toBe('worker-a');

    // The lease is held, so a second worker gets nothing.
    const workerB = await service.claimDue('worker-b');
    expect(workerB).toHaveLength(0);
  });

  it('does not claim an action that is not yet due', async () => {
    await service.schedule(
      scheduleInput({ dueAt: new Date(Date.now() + 3_600_000).toISOString() })
    );
    expect(await service.claimDue('worker-a')).toHaveLength(0);
  });

  it('refuses completion from a worker that does not hold the lease', async () => {
    await service.schedule(scheduleInput());
    const [claimed] = await service.claimDue('worker-a');

    await expect(service.complete(claimed!.id, 'worker-b')).rejects.toThrow(/leased to/i);

    const done = await service.complete(claimed!.id, 'worker-a');
    expect(done.status).toBe('COMPLETED');
  });

  it('returns a failed action to PENDING until the retry budget is spent', async () => {
    await service.schedule(scheduleInput({ maxAttempts: 2 }));

    const [first] = await service.claimDue('worker-a');
    const attempt1 = await service.fail(first!.id, 'worker-a', 'provider timeout');
    expect(attempt1.exhausted).toBe(false);
    expect(attempt1.action.status).toBe('PENDING');
    expect(attempt1.action.attempts).toBe(1);

    const [second] = await service.claimDue('worker-a');
    expect(second).toBeDefined();
    const attempt2 = await service.fail(second!.id, 'worker-a', 'provider timeout');
    expect(attempt2.exhausted).toBe(true);
    expect(attempt2.action.status).toBe('FAILED');
    expect(attempt2.action.lastError).toBe('provider timeout');
  });

  it('releases the lease on completion so the row is not re-claimed', async () => {
    await service.schedule(scheduleInput());
    const [claimed] = await service.claimDue('worker-a');
    await service.complete(claimed!.id, 'worker-a');

    expect(await service.claimDue('worker-b')).toHaveLength(0);
  });

  it('refuses to schedule without a resolved tenant binding', async () => {
    await expect(
      service.schedule(scheduleInput({ tenantId: '', companyId: '' }))
    ).rejects.toThrow(/tenant\/company binding/i);
  });

  it('cancels a pending action', async () => {
    const { action } = await service.schedule(scheduleInput());
    const cancelled = await service.cancel(action.id, 'thread closed');
    expect(cancelled.status).toBe('CANCELLED');
    expect(await service.claimDue('worker-a')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────
// CREDENTIAL BINDING — secret-material guard
// ─────────────────────────────────────────

describe('CredentialBinding', () => {
  function binding(secretRef: string) {
    return {
      id: '33333333-3333-4333-8333-333333333333',
      createdAt: '2026-10-07T12:00:00.000Z',
      updatedAt: '2026-10-07T12:00:00.000Z',
      ...BINDING,
      provider: 'resend',
      secretRef,
      environment: 'production' as const,
    };
  }

  it('accepts a reference into the secret manager', () => {
    const parsed = CredentialBindingSchema.safeParse(
      binding('gcp-sm://hutchrok/resend-api-key#3')
    );
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.classification).toBe('SECRET');
  });

  it('rejects secret material pasted in place of a reference', () => {
    const rejected = [
      'sk-proj-abcdefghijklmnopqrstuvwxyz',
      'sk_live_51H8xYzAbCdEfGhIjKlMnOp',
      'ghp_abcdefghijklmnopqrstuvwxyz1234',
      'xoxb-123456789012-abcdefghijkl',
      'AKIAIOSFODNN7EXAMPLE',
      're_123456789abcdefghijklmnop',
      'SG.abcdefghijklmnop.qrstuvwxyz',
      '-----BEGIN RSA PRIVATE KEY-----',
      'a'.repeat(64),
    ];

    for (const value of rejected) {
      expect(looksLikeSecretMaterial(value), `should flag ${value}`).toBe(true);
      expect(CredentialBindingSchema.safeParse(binding(value)).success).toBe(false);
    }
  });

  it('does not flag an ordinary secret-manager path', () => {
    expect(looksLikeSecretMaterial('gcp-sm://hutchrok/resend-api-key#3')).toBe(false);
    expect(looksLikeSecretMaterial('vault://hutchrok/kv/telephony')).toBe(false);
    expect(looksLikeSecretMaterial('env:RESEND_API_KEY')).toBe(false);
  });
});
