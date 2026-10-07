/**
 * Hutchrok OS — Exception Queue
 *
 * Section 12: "External completion requires provider evidence. Failure goes
 * to exception queue." Section 15: "Provider outage/failure produces visible
 * exception and retry state rather than false completion."
 *
 * Nothing in this package can resolve its own exception — `resolve` and
 * `acknowledge` both require a human identity. The Executive Exception agent
 * presents items here; it never clears them.
 */

import { generateId, nowISO } from '@hutchrok-os/shared';
import type {
  ExceptionQueueItem,
  ExceptionReason,
  ExceptionStatus,
  TenantBinding,
} from '@hutchrok-os/domain';

export interface RaiseExceptionInput extends TenantBinding {
  reason: ExceptionReason;
  summary: string;
  ownerRole: string;
  correlationId: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detail?: string;
  assignmentId?: string;
  activityEventId?: string;
  evidenceRefs?: string[];
  attempts?: number;
  metadata?: Record<string, unknown>;
}

export interface ExceptionStore {
  create(item: ExceptionQueueItem): Promise<void>;
  findById(id: string): Promise<ExceptionQueueItem | null>;
  list(filter: {
    status?: ExceptionStatus;
    reason?: ExceptionReason;
    ownerRole?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<ExceptionQueueItem[]>;
  /** Atomically move an item out of `from`. Returns null if it was not in that state. */
  transition(
    id: string,
    from: ExceptionStatus[],
    to: ExceptionStatus,
    patch: Partial<ExceptionQueueItem>
  ): Promise<ExceptionQueueItem | null>;
}

export class ExceptionQueue {
  constructor(private readonly store: ExceptionStore) {}

  async raise(input: RaiseExceptionInput): Promise<ExceptionQueueItem> {
    if (!input.tenantId || !input.companyId) {
      throw new Error('Cannot raise an exception without a resolved tenant/company binding.');
    }

    const now = nowISO();
    const item: ExceptionQueueItem = {
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      tenantId: input.tenantId,
      companyId: input.companyId,
      reason: input.reason,
      severity: input.severity ?? 'MEDIUM',
      summary: input.summary,
      ...(input.detail !== undefined ? { detail: input.detail } : {}),
      ...(input.assignmentId !== undefined ? { assignmentId: input.assignmentId } : {}),
      ...(input.activityEventId !== undefined
        ? { activityEventId: input.activityEventId }
        : {}),
      ownerRole: input.ownerRole,
      status: 'OPEN',
      evidenceRefs: input.evidenceRefs ?? [],
      attempts: input.attempts ?? 0,
      correlationId: input.correlationId,
      metadata: input.metadata ?? {},
    };

    await this.store.create(item);
    return item;
  }

  /** A human takes ownership. Agent IDs are rejected. */
  async acknowledge(id: string, userId: string): Promise<ExceptionQueueItem> {
    assertHuman(userId, 'acknowledge');
    const now = nowISO();
    const updated = await this.store.transition(id, ['OPEN'], 'ACKNOWLEDGED', {
      acknowledgedBy: userId,
      acknowledgedAt: now,
      updatedAt: now,
    });
    if (!updated) throw new Error(`Exception ${id} is not OPEN.`);
    return updated;
  }

  /** A human closes the item with a stated resolution. */
  async resolve(id: string, userId: string, resolution: string): Promise<ExceptionQueueItem> {
    assertHuman(userId, 'resolve');
    if (!resolution.trim()) {
      throw new Error('Resolving an exception requires a stated resolution.');
    }
    const now = nowISO();
    const updated = await this.store.transition(
      id,
      ['OPEN', 'ACKNOWLEDGED'],
      'RESOLVED',
      { resolvedBy: userId, resolvedAt: now, resolution, updatedAt: now }
    );
    if (!updated) throw new Error(`Exception ${id} is not OPEN or ACKNOWLEDGED.`);
    return updated;
  }

  /**
   * Retries are exhausted. The item stays visible — dead letter is a
   * terminal state for automation, not a deletion.
   */
  async deadLetter(id: string, detail: string): Promise<ExceptionQueueItem> {
    const now = nowISO();
    const updated = await this.store.transition(
      id,
      ['OPEN', 'ACKNOWLEDGED'],
      'DEAD_LETTER',
      { detail, severity: 'HIGH', updatedAt: now }
    );
    if (!updated) throw new Error(`Exception ${id} is not OPEN or ACKNOWLEDGED.`);
    return updated;
  }

  async open(filter?: { ownerRole?: string; tenantId?: string; limit?: number }): Promise<ExceptionQueueItem[]> {
    return this.store.list({ status: 'OPEN', ...(filter ?? {}) });
  }

  async list(filter: {
    status?: ExceptionStatus;
    reason?: ExceptionReason;
    ownerRole?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<ExceptionQueueItem[]> {
    return this.store.list(filter);
  }
}

/**
 * Section 5: the Executive Exception agent "never self-approves", and
 * Section 12 forbids an AI agent impersonating a human. Clearing an
 * exception is a human act.
 */
const AGENT_ID_PATTERN = /^(agent[:_-]|claude-|hutchrok-executive$|site-autopilot$)/i;

function assertHuman(userId: string, action: string): void {
  if (!userId.trim()) {
    throw new Error(`Cannot ${action} an exception without an identified user.`);
  }
  if (AGENT_ID_PATTERN.test(userId)) {
    throw new Error(
      `"${userId}" looks like an agent identity. Only a human may ${action} an exception.`
    );
  }
}

// ─────────────────────────────────────────
// IN-MEMORY STORE (testing / dev)
// ─────────────────────────────────────────

export class InMemoryExceptionStore implements ExceptionStore {
  private items = new Map<string, ExceptionQueueItem>();

  async create(item: ExceptionQueueItem): Promise<void> {
    this.items.set(item.id, structuredClone(item));
  }

  async findById(id: string): Promise<ExceptionQueueItem | null> {
    const found = this.items.get(id);
    return found ? structuredClone(found) : null;
  }

  async list(filter: {
    status?: ExceptionStatus;
    reason?: ExceptionReason;
    ownerRole?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<ExceptionQueueItem[]> {
    const out = [...this.items.values()]
      .filter((i) => {
        if (filter.status && i.status !== filter.status) return false;
        if (filter.reason && i.reason !== filter.reason) return false;
        if (filter.ownerRole && i.ownerRole !== filter.ownerRole) return false;
        if (filter.tenantId && i.tenantId !== filter.tenantId) return false;
        return true;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const limited = filter.limit ? out.slice(0, filter.limit) : out;
    return limited.map((i) => structuredClone(i));
  }

  async transition(
    id: string,
    from: ExceptionStatus[],
    to: ExceptionStatus,
    patch: Partial<ExceptionQueueItem>
  ): Promise<ExceptionQueueItem | null> {
    const existing = this.items.get(id);
    if (!existing || !from.includes(existing.status)) return null;
    const updated: ExceptionQueueItem = { ...existing, ...patch, status: to };
    this.items.set(id, updated);
    return structuredClone(updated);
  }

  all(): ExceptionQueueItem[] {
    return [...this.items.values()].map((i) => structuredClone(i));
  }
}
