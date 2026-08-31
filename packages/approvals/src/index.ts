/**
 * Hutchrok OS — Approval System
 *
 * Four levels: A (automatic), B (policy-controlled), C (human), D (owner-only)
 *
 * Level A — Auto-approved: classification, summaries, task creation, analytics
 * Level B — Policy automation: reminders, doc requests, routine follow-ups
 * Level C — Human approval: filings, refunds, contracts, production deploy
 * Level D — Owner/Fee only: bank movement, secrets, destructive actions
 */

import { generateId, nowISO } from '@hutchrok-os/shared';
import type { Approval } from '@hutchrok-os/domain';

export type ApprovalLevel = 'A' | 'B' | 'C' | 'D';

export interface ApprovalRequest {
  level: ApprovalLevel;
  entityType: string;
  entityId: string;
  requestedByUserId?: string;
  requestedByAgentId?: string;
  reason?: string;
  correlationId?: string;
  expiresInMs?: number;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────
// APPROVAL STORE INTERFACE
// ─────────────────────────────────────────

export interface ApprovalStore {
  create(approval: Approval): Promise<void>;
  findById(id: string): Promise<Approval | null>;
  findPending(filter: { entityType?: string; level?: ApprovalLevel }): Promise<Approval[]>;
  update(id: string, updates: Partial<Approval>): Promise<void>;
}

// ─────────────────────────────────────────
// APPROVAL SERVICE
// ─────────────────────────────────────────

export interface ApprovalCallbacks {
  onApproved?: (approval: Approval) => Promise<void>;
  onRejected?: (approval: Approval) => Promise<void>;
  onExpired?: (approval: Approval) => Promise<void>;
}

export class ApprovalService {
  constructor(
    private readonly store: ApprovalStore,
    private readonly callbacks?: ApprovalCallbacks
  ) {}

  async request(req: ApprovalRequest): Promise<Approval> {
    const now = nowISO();
    const expiresAt = req.expiresInMs
      ? new Date(Date.now() + req.expiresInMs).toISOString()
      : undefined;

    // Level A and B can be auto-approved based on policy
    const autoApproved = req.level === 'A' || (req.level === 'B' && this.isAutoApprovedByPolicy(req));

    const approval: Approval = {
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      entityType: req.entityType,
      entityId: req.entityId,
      level: req.level,
      requestedByUserId: req.requestedByUserId,
      requestedByAgentId: req.requestedByAgentId,
      status: autoApproved ? 'AUTO_APPROVED' : 'PENDING',
      reason: req.reason,
      expiresAt,
      correlationId: req.correlationId,
      metadata: req.metadata ?? {},
    };

    await this.store.create(approval);

    if (autoApproved && this.callbacks?.onApproved) {
      await this.callbacks.onApproved(approval);
    }

    return approval;
  }

  async approve(
    approvalId: string,
    approvedByUserId: string,
    reason?: string
  ): Promise<Approval> {
    const approval = await this.store.findById(approvalId);
    if (!approval) throw new Error(`Approval ${approvalId} not found.`);
    if (approval.status !== 'PENDING') {
      throw new Error(`Approval ${approvalId} is not in PENDING status (current: ${approval.status}).`);
    }

    const updated: Approval = {
      ...approval,
      status: 'APPROVED',
      approvedByUserId,
      reason: reason ?? approval.reason,
      resolvedAt: nowISO(),
      updatedAt: nowISO(),
    };

    await this.store.update(approvalId, updated);

    if (this.callbacks?.onApproved) {
      await this.callbacks.onApproved(updated);
    }

    return updated;
  }

  async reject(
    approvalId: string,
    rejectedByUserId: string,
    reason?: string
  ): Promise<Approval> {
    const approval = await this.store.findById(approvalId);
    if (!approval) throw new Error(`Approval ${approvalId} not found.`);
    if (approval.status !== 'PENDING') {
      throw new Error(`Approval ${approvalId} is not in PENDING status.`);
    }

    const updated: Approval = {
      ...approval,
      status: 'REJECTED',
      approvedByUserId: rejectedByUserId,
      reason,
      resolvedAt: nowISO(),
      updatedAt: nowISO(),
    };

    await this.store.update(approvalId, updated);

    if (this.callbacks?.onRejected) {
      await this.callbacks.onRejected(updated);
    }

    return updated;
  }

  async getPending(filter?: { entityType?: string; level?: ApprovalLevel }): Promise<Approval[]> {
    return this.store.findPending(filter ?? {});
  }

  private isAutoApprovedByPolicy(req: ApprovalRequest): boolean {
    // Level B auto-approval rules based on entity type
    const levelBAutoTypes = [
      'reminder',
      'document_request',
      'routine_followup',
      'routine_status_message',
      'pre_approved_social',
    ];
    return levelBAutoTypes.includes(req.entityType);
  }
}

// ─────────────────────────────────────────
// IN-MEMORY APPROVAL STORE (testing / dev)
// ─────────────────────────────────────────

export class InMemoryApprovalStore implements ApprovalStore {
  private approvals: Map<string, Approval> = new Map();

  async create(approval: Approval): Promise<void> {
    this.approvals.set(approval.id, approval);
  }

  async findById(id: string): Promise<Approval | null> {
    return this.approvals.get(id) ?? null;
  }

  async findPending(filter: { entityType?: string; level?: ApprovalLevel }): Promise<Approval[]> {
    return [...this.approvals.values()].filter((a) => {
      if (a.status !== 'PENDING') return false;
      if (filter.entityType && a.entityType !== filter.entityType) return false;
      if (filter.level && a.level !== filter.level) return false;
      return true;
    });
  }

  async update(id: string, updates: Partial<Approval>): Promise<void> {
    const existing = this.approvals.get(id);
    if (existing) {
      this.approvals.set(id, { ...existing, ...updates });
    }
  }

  getAll(): Approval[] {
    return [...this.approvals.values()];
  }
}
