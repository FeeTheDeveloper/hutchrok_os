/**
 * Hutchrok OS — Audit Service
 *
 * Append-oriented audit logging for all consequential actions.
 * Records: user actions, agent actions, MCP calls, connector calls,
 * approvals, state transitions, data changes, knowledge changes,
 * deployments, authentication/security events.
 */

import { generateId, generateCorrelationId, nowISO } from '@hutchrok-os/shared';
import type { AuditLog } from '@hutchrok-os/domain';

// ─────────────────────────────────────────
// AUDIT SINK INTERFACE
// Implement this to persist audit records.
// ─────────────────────────────────────────

export interface AuditSink {
  append(record: AuditLog): Promise<void>;
  query(filter: AuditQueryFilter): Promise<AuditLog[]>;
}

export interface AuditQueryFilter {
  actor?: string;
  actionType?: string;
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

// ─────────────────────────────────────────
// AUDIT SERVICE
// ─────────────────────────────────────────

export interface CreateAuditRecordOptions {
  actor: string;
  actorType: AuditLog['actorType'];
  actionType: string;
  entityType?: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  result: AuditLog['result'];
  errorMessage?: string;
  correlationId?: string;
  causationId?: string;
  source?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  constructor(private readonly sink: AuditSink) {}

  async record(opts: CreateAuditRecordOptions): Promise<AuditLog> {
    const record: AuditLog = {
      id: generateId(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      actor: opts.actor,
      actorType: opts.actorType,
      actionType: opts.actionType,
      entityType: opts.entityType,
      entityId: opts.entityId,
      before: opts.before,
      after: opts.after,
      result: opts.result,
      errorMessage: opts.errorMessage,
      correlationId: opts.correlationId ?? generateCorrelationId(),
      causationId: opts.causationId,
      source: opts.source,
      ipAddress: opts.ipAddress,
      metadata: opts.metadata ?? {},
    };

    await this.sink.append(record);
    return record;
  }

  async query(filter: AuditQueryFilter): Promise<AuditLog[]> {
    return this.sink.query(filter);
  }
}

// ─────────────────────────────────────────
// IN-MEMORY AUDIT SINK (for testing / local dev)
// ─────────────────────────────────────────

export class InMemoryAuditSink implements AuditSink {
  private records: AuditLog[] = [];

  async append(record: AuditLog): Promise<void> {
    this.records.push(record);
  }

  async query(filter: AuditQueryFilter): Promise<AuditLog[]> {
    let results = [...this.records];

    if (filter.actor) results = results.filter((r) => r.actor === filter.actor);
    if (filter.actionType) results = results.filter((r) => r.actionType === filter.actionType);
    if (filter.entityType) results = results.filter((r) => r.entityType === filter.entityType);
    if (filter.entityId) results = results.filter((r) => r.entityId === filter.entityId);
    if (filter.correlationId) results = results.filter((r) => r.correlationId === filter.correlationId);

    return results.slice(0, filter.limit ?? 100);
  }

  getAll(): AuditLog[] {
    return [...this.records];
  }

  clear(): void {
    this.records = [];
  }
}
