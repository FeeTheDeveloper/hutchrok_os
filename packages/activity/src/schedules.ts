/**
 * Hutchrok OS — Scheduled Actions
 *
 * Section 4 SCHEDULE: follow-up, deadline, compliance, marketing or service
 * action. Section 15: inbound work must be "safely retryable" — so a
 * schedule is claimed under a lease and keyed for idempotency. Two workers
 * polling the same due action cannot both run it, and re-requesting the same
 * logical follow-up does not queue it twice.
 */

import { generateId, nowISO } from '@hutchrok-os/shared';
import type { ScheduledAction, ScheduledActionStatus, TenantBinding } from '@hutchrok-os/domain';

export interface ScheduleInput extends TenantBinding {
  kind: string;
  dueAt: string;
  idempotencyKey: string;
  correlationId: string;
  payload?: Record<string, unknown>;
  assignmentId?: string;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

export interface ScheduleStore {
  /**
   * Insert unless `idempotencyKey` already exists. Returns the existing row
   * when it does, so callers can tell a fresh schedule from a duplicate.
   *
   * Persistent implementations: unique index on (tenant_id, idempotency_key)
   * with `INSERT ... ON CONFLICT DO NOTHING` plus a follow-up select.
   */
  insertUnique(action: ScheduledAction): Promise<{ created: boolean; action: ScheduledAction }>;
  findById(id: string): Promise<ScheduledAction | null>;
  /**
   * Atomically claim up to `limit` actions due at or before `nowISO`, setting
   * the lease. Persistent implementations: `SELECT ... FOR UPDATE SKIP LOCKED`.
   */
  claimDue(opts: {
    nowISO: string;
    limit: number;
    lockedBy: string;
    lockedUntil: string;
    tenantId?: string;
  }): Promise<ScheduledAction[]>;
  transition(
    id: string,
    from: ScheduledActionStatus[],
    to: ScheduledActionStatus,
    patch: Partial<ScheduledAction>
  ): Promise<ScheduledAction | null>;
  list(filter: {
    status?: ScheduledActionStatus;
    kind?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<ScheduledAction[]>;
}

export interface ScheduleServiceConfig {
  /** How long a claim is held before another worker may retake it. */
  leaseMs: number;
}

const DEFAULT_LEASE_MS = 60_000;

export class ScheduleService {
  private readonly leaseMs: number;

  constructor(
    private readonly store: ScheduleStore,
    config?: Partial<ScheduleServiceConfig>
  ) {
    this.leaseMs = config?.leaseMs ?? DEFAULT_LEASE_MS;
  }

  /** Queues an action, or returns the existing one for the same key. */
  async schedule(input: ScheduleInput): Promise<{ created: boolean; action: ScheduledAction }> {
    if (!input.tenantId || !input.companyId) {
      throw new Error('Cannot schedule an action without a resolved tenant/company binding.');
    }

    const now = nowISO();
    const action: ScheduledAction = {
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      tenantId: input.tenantId,
      companyId: input.companyId,
      kind: input.kind,
      dueAt: input.dueAt,
      payload: input.payload ?? {},
      status: 'PENDING',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      ...(input.assignmentId !== undefined ? { assignmentId: input.assignmentId } : {}),
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      metadata: input.metadata ?? {},
    };

    return this.store.insertUnique(action);
  }

  /** Claims due actions under a lease. Only the holder may complete them. */
  async claimDue(lockedBy: string, limit = 10, tenantId?: string): Promise<ScheduledAction[]> {
    const now = Date.now();
    return this.store.claimDue({
      nowISO: new Date(now).toISOString(),
      limit,
      lockedBy,
      lockedUntil: new Date(now + this.leaseMs).toISOString(),
      ...(tenantId !== undefined ? { tenantId } : {}),
    });
  }

  async complete(id: string, lockedBy: string): Promise<ScheduledAction> {
    const existing = await this.store.findById(id);
    if (!existing) throw new Error(`No scheduled action ${id}.`);
    if (existing.lockedBy !== lockedBy) {
      throw new Error(
        `Scheduled action ${id} is leased to ${existing.lockedBy ?? 'nobody'}, not ${lockedBy}.`
      );
    }
    const now = nowISO();
    const updated = await this.store.transition(id, ['CLAIMED'], 'COMPLETED', {
      updatedAt: now,
      lockedUntil: undefined,
      lockedBy: undefined,
    });
    if (!updated) throw new Error(`Scheduled action ${id} is not CLAIMED.`);
    return updated;
  }

  /**
   * Records a failed attempt. Returns `exhausted: true` when the retry
   * budget is spent — the caller then raises an exception rather than
   * leaving the action to spin.
   */
  async fail(
    id: string,
    lockedBy: string,
    error: string
  ): Promise<{ action: ScheduledAction; exhausted: boolean }> {
    const existing = await this.store.findById(id);
    if (!existing) throw new Error(`No scheduled action ${id}.`);
    if (existing.lockedBy !== lockedBy) {
      throw new Error(
        `Scheduled action ${id} is leased to ${existing.lockedBy ?? 'nobody'}, not ${lockedBy}.`
      );
    }

    const attempts = existing.attempts + 1;
    const exhausted = attempts >= existing.maxAttempts;
    const now = nowISO();

    const updated = await this.store.transition(
      id,
      ['CLAIMED'],
      exhausted ? 'FAILED' : 'PENDING',
      { attempts, lastError: error, updatedAt: now, lockedUntil: undefined, lockedBy: undefined }
    );
    if (!updated) throw new Error(`Scheduled action ${id} is not CLAIMED.`);
    return { action: updated, exhausted };
  }

  async cancel(id: string, reason: string): Promise<ScheduledAction> {
    const updated = await this.store.transition(id, ['PENDING', 'CLAIMED'], 'CANCELLED', {
      lastError: reason,
      updatedAt: nowISO(),
      lockedUntil: undefined,
      lockedBy: undefined,
    });
    if (!updated) throw new Error(`Scheduled action ${id} is not PENDING or CLAIMED.`);
    return updated;
  }

  async list(filter?: {
    status?: ScheduledActionStatus;
    kind?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<ScheduledAction[]> {
    return this.store.list(filter ?? {});
  }
}

// ─────────────────────────────────────────
// IN-MEMORY STORE (testing / dev)
// ─────────────────────────────────────────

export class InMemoryScheduleStore implements ScheduleStore {
  private items = new Map<string, ScheduledAction>();
  private byKey = new Map<string, string>();

  private keyOf(action: Pick<ScheduledAction, 'tenantId' | 'idempotencyKey'>): string {
    return `${action.tenantId}:${action.idempotencyKey}`;
  }

  async insertUnique(
    action: ScheduledAction
  ): Promise<{ created: boolean; action: ScheduledAction }> {
    const key = this.keyOf(action);
    const existingId = this.byKey.get(key);
    if (existingId) {
      const existing = this.items.get(existingId);
      if (existing) return { created: false, action: structuredClone(existing) };
    }
    this.items.set(action.id, structuredClone(action));
    this.byKey.set(key, action.id);
    return { created: true, action: structuredClone(action) };
  }

  async findById(id: string): Promise<ScheduledAction | null> {
    const found = this.items.get(id);
    return found ? structuredClone(found) : null;
  }

  async claimDue(opts: {
    nowISO: string;
    limit: number;
    lockedBy: string;
    lockedUntil: string;
    tenantId?: string;
  }): Promise<ScheduledAction[]> {
    const claimed: ScheduledAction[] = [];

    for (const action of [...this.items.values()].sort((a, b) =>
      a.dueAt < b.dueAt ? -1 : 1
    )) {
      if (claimed.length >= opts.limit) break;
      if (opts.tenantId && action.tenantId !== opts.tenantId) continue;
      if (action.dueAt > opts.nowISO) continue;

      const leaseExpired = !action.lockedUntil || action.lockedUntil <= opts.nowISO;
      const claimable =
        action.status === 'PENDING' || (action.status === 'CLAIMED' && leaseExpired);
      if (!claimable) continue;

      const updated: ScheduledAction = {
        ...action,
        status: 'CLAIMED',
        lockedBy: opts.lockedBy,
        lockedUntil: opts.lockedUntil,
        updatedAt: opts.nowISO,
      };
      this.items.set(updated.id, updated);
      claimed.push(structuredClone(updated));
    }

    return claimed;
  }

  async transition(
    id: string,
    from: ScheduledActionStatus[],
    to: ScheduledActionStatus,
    patch: Partial<ScheduledAction>
  ): Promise<ScheduledAction | null> {
    const existing = this.items.get(id);
    if (!existing || !from.includes(existing.status)) return null;

    const updated: ScheduledAction = { ...existing, ...patch, status: to };
    // `lockedUntil: undefined` in a patch means release the lease.
    if ('lockedUntil' in patch && patch.lockedUntil === undefined) delete updated.lockedUntil;
    if ('lockedBy' in patch && patch.lockedBy === undefined) delete updated.lockedBy;

    this.items.set(id, updated);
    return structuredClone(updated);
  }

  async list(filter: {
    status?: ScheduledActionStatus;
    kind?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<ScheduledAction[]> {
    const out = [...this.items.values()]
      .filter((a) => {
        if (filter.status && a.status !== filter.status) return false;
        if (filter.kind && a.kind !== filter.kind) return false;
        if (filter.tenantId && a.tenantId !== filter.tenantId) return false;
        return true;
      })
      .sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1));
    const limited = filter.limit ? out.slice(0, filter.limit) : out;
    return limited.map((a) => structuredClone(a));
  }

  all(): ScheduledAction[] {
    return [...this.items.values()].map((a) => structuredClone(a));
  }
}
