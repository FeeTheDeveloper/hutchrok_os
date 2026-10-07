/**
 * Hutchrok OS — Assignments
 *
 * Section 6: one accountable primary agent per assignment; specialists
 * attach as dependencies. Section 4 VERIFY: "agent intent alone never
 * equals completion" — so `complete()` refuses without the evidence the
 * assignment declared it would need.
 */

import { generateId, nowISO } from '@hutchrok-os/shared';
import {
  AssignmentSchema,
  type Assignment,
  type AssignmentStatus,
  type DataClassification,
  type ServiceLane,
  type TenantBinding,
} from '@hutchrok-os/domain';

export interface CreateAssignmentInput extends TenantBinding {
  objective: string;
  triggeringEventId: string;
  agentId: string;
  controller: string;
  lane: ServiceLane;
  exceptionOwner: string;
  correlationId: string;
  inputs?: Record<string, unknown>;
  evidenceRefs?: string[];
  allowedCapabilities?: string[];
  exclusions?: string[];
  classification?: DataClassification;
  credentialScope?: string[];
  approvalLevel?: 'A' | 'B' | 'C' | 'D';
  dependencies?: string[];
  slaId?: string;
  acceptanceCriteria?: string[];
  evidenceRequired?: string[];
  handoffTarget?: string;
  retryPolicy?: { maxAttempts: number; backoffMs: number };
  metadata?: Record<string, unknown>;
}

export interface AssignmentStore {
  create(assignment: Assignment): Promise<void>;
  findById(id: string): Promise<Assignment | null>;
  list(filter: {
    status?: AssignmentStatus;
    lane?: ServiceLane;
    agentId?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<Assignment[]>;
  /** Atomically move out of `from`. Returns null if it was not in one of those states. */
  transition(
    id: string,
    from: AssignmentStatus[],
    to: AssignmentStatus,
    patch: Partial<Assignment>
  ): Promise<Assignment | null>;
}

export class AssignmentService {
  constructor(private readonly store: AssignmentStore) {}

  async create(input: CreateAssignmentInput): Promise<Assignment> {
    if (!input.tenantId || !input.companyId) {
      throw new Error('Cannot create an assignment without a resolved tenant/company binding.');
    }

    const allowed = input.allowedCapabilities ?? [];
    const excluded = input.exclusions ?? [];
    const conflict = allowed.filter((c) => excluded.includes(c));
    if (conflict.length > 0) {
      throw new Error(
        `Capabilities cannot be both allowed and excluded: ${conflict.join(', ')}.`
      );
    }

    const now = nowISO();
    const assignment = AssignmentSchema.parse({
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      tenantId: input.tenantId,
      companyId: input.companyId,
      objective: input.objective,
      triggeringEventId: input.triggeringEventId,
      agentId: input.agentId,
      controller: input.controller,
      lane: input.lane,
      inputs: input.inputs ?? {},
      evidenceRefs: input.evidenceRefs ?? [],
      allowedCapabilities: allowed,
      exclusions: excluded,
      classification: input.classification ?? 'INTERNAL',
      credentialScope: input.credentialScope ?? [],
      approvalLevel: input.approvalLevel ?? 'A',
      dependencies: input.dependencies ?? [],
      slaId: input.slaId,
      acceptanceCriteria: input.acceptanceCriteria ?? [],
      evidenceRequired: input.evidenceRequired ?? [],
      handoffTarget: input.handoffTarget,
      retryPolicy: input.retryPolicy ?? { maxAttempts: 3, backoffMs: 30_000 },
      exceptionOwner: input.exceptionOwner,
      status: 'PENDING',
      attempts: 0,
      correlationId: input.correlationId,
      metadata: input.metadata ?? {},
    });

    await this.store.create(assignment);
    return assignment;
  }

  /**
   * Whether this assignment may use a capability. Exclusions win over the
   * allow-list, and an empty allow-list grants nothing.
   */
  authorizeCapability(assignment: Assignment, capability: string): boolean {
    if (assignment.exclusions.includes(capability)) return false;
    return assignment.allowedCapabilities.includes(capability);
  }

  /**
   * Whether this assignment may touch a credential scope. Section 6: agents
   * cannot reach another portfolio company's credentials.
   */
  authorizeCredential(assignment: Assignment, scope: string): boolean {
    return assignment.credentialScope.includes(scope);
  }

  async start(id: string): Promise<Assignment> {
    const now = nowISO();
    const existing = await this.store.findById(id);
    if (!existing) throw new Error(`No assignment ${id}.`);
    const updated = await this.store.transition(id, ['PENDING', 'BLOCKED'], 'IN_PROGRESS', {
      attempts: existing.attempts + 1,
      updatedAt: now,
    });
    if (!updated) throw new Error(`Assignment ${id} is not PENDING or BLOCKED.`);
    return updated;
  }

  async awaitApproval(id: string): Promise<Assignment> {
    const updated = await this.store.transition(
      id,
      ['PENDING', 'IN_PROGRESS'],
      'AWAITING_APPROVAL',
      { updatedAt: nowISO() }
    );
    if (!updated) throw new Error(`Assignment ${id} is not PENDING or IN_PROGRESS.`);
    return updated;
  }

  async block(id: string, reason: string): Promise<Assignment> {
    const updated = await this.store.transition(
      id,
      ['PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL'],
      'BLOCKED',
      { updatedAt: nowISO(), metadata: { blockedReason: reason } }
    );
    if (!updated) throw new Error(`Assignment ${id} cannot be blocked from its current state.`);
    return updated;
  }

  /**
   * Completion requires evidence for every kind the assignment declared.
   * Section 4 VERIFY — provider evidence, not agent assertion.
   */
  async complete(id: string, evidenceRefs: string[]): Promise<Assignment> {
    const existing = await this.store.findById(id);
    if (!existing) throw new Error(`No assignment ${id}.`);

    const missing = existing.evidenceRequired.filter(
      (kind) => !evidenceRefs.some((ref) => ref.startsWith(`${kind}:`))
    );
    if (missing.length > 0) {
      throw new Error(
        `Cannot complete assignment ${id}: missing evidence for ${missing.join(', ')}. ` +
          'Expected refs prefixed "<kind>:".'
      );
    }

    const updated = await this.store.transition(
      id,
      ['IN_PROGRESS', 'AWAITING_APPROVAL'],
      'COMPLETED',
      {
        evidenceRefs: [...new Set([...existing.evidenceRefs, ...evidenceRefs])],
        updatedAt: nowISO(),
      }
    );
    if (!updated) throw new Error(`Assignment ${id} is not IN_PROGRESS or AWAITING_APPROVAL.`);
    return updated;
  }

  async fail(id: string, reason: string): Promise<Assignment> {
    const updated = await this.store.transition(
      id,
      ['PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'BLOCKED'],
      'FAILED',
      { updatedAt: nowISO(), metadata: { failureReason: reason } }
    );
    if (!updated) throw new Error(`Assignment ${id} cannot be failed from its current state.`);
    return updated;
  }

  /** True when the retry budget is spent and the item belongs in the exception queue. */
  retriesExhausted(assignment: Assignment): boolean {
    return assignment.attempts >= assignment.retryPolicy.maxAttempts;
  }

  async get(id: string): Promise<Assignment | null> {
    return this.store.findById(id);
  }

  async list(filter?: {
    status?: AssignmentStatus;
    lane?: ServiceLane;
    agentId?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<Assignment[]> {
    return this.store.list(filter ?? {});
  }
}

// ─────────────────────────────────────────
// IN-MEMORY STORE (testing / dev)
// ─────────────────────────────────────────

export class InMemoryAssignmentStore implements AssignmentStore {
  private items = new Map<string, Assignment>();

  async create(assignment: Assignment): Promise<void> {
    this.items.set(assignment.id, structuredClone(assignment));
  }

  async findById(id: string): Promise<Assignment | null> {
    const found = this.items.get(id);
    return found ? structuredClone(found) : null;
  }

  async list(filter: {
    status?: AssignmentStatus;
    lane?: ServiceLane;
    agentId?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<Assignment[]> {
    const out = [...this.items.values()]
      .filter((a) => {
        if (filter.status && a.status !== filter.status) return false;
        if (filter.lane && a.lane !== filter.lane) return false;
        if (filter.agentId && a.agentId !== filter.agentId) return false;
        if (filter.tenantId && a.tenantId !== filter.tenantId) return false;
        return true;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    const limited = filter.limit ? out.slice(0, filter.limit) : out;
    return limited.map((a) => structuredClone(a));
  }

  async transition(
    id: string,
    from: AssignmentStatus[],
    to: AssignmentStatus,
    patch: Partial<Assignment>
  ): Promise<Assignment | null> {
    const existing = this.items.get(id);
    if (!existing || !from.includes(existing.status)) return null;
    const updated: Assignment = {
      ...existing,
      ...patch,
      status: to,
      metadata: { ...existing.metadata, ...(patch.metadata ?? {}) },
    };
    this.items.set(id, updated);
    return structuredClone(updated);
  }

  all(): Assignment[] {
    return [...this.items.values()].map((a) => structuredClone(a));
  }
}
