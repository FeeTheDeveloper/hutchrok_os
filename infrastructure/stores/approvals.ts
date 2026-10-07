/**
 * Hutchrok OS — Postgres approval store
 *
 * `resolvePending` is the statement that matters. CLAUDE.md forbids
 * weakening approval enforcement, so the guard is in SQL rather than in a
 * read-then-write: an approval leaves PENDING exactly once, and an expired
 * one becomes EXPIRED instead of APPROVED even if the approve call wins the
 * race to reach the row.
 *
 * Note on identity columns: `requested_by_user_id` and `approved_by_user_id`
 * are text, not uuid. Approver ids come from AUTOPILOT_APPROVERS_JSON as
 * arbitrary configured strings, and a superseded draft records the agent id
 * ('site-autopilot') as the rejecter. Migration 0001 changed these.
 */

import { sql } from 'drizzle-orm';
import type { Approval } from '@hutchrok-os/domain';
import type { ApprovalLevel, ApprovalStore } from '@hutchrok-os/approvals';

import {
  col,
  firstRow,
  rowsOf,
  toBool,
  toISO,
  toISOOptional,
  toRecord,
  toStringOptional,
  type SqlExecutor,
} from './sql.js';

type Row = Record<string, unknown>;

function mapApproval(row: Row): Approval {
  const requestedByUserId = toStringOptional(col(row, 'requested_by_user_id'));
  const requestedByAgentId = toStringOptional(col(row, 'requested_by_agent_id'));
  const approvedByUserId = toStringOptional(col(row, 'approved_by_user_id'));
  const reason = toStringOptional(col(row, 'reason'));
  const expiresAt = toISOOptional(col(row, 'expires_at'));
  const resolvedAt = toISOOptional(col(row, 'resolved_at'));
  const correlationId = toStringOptional(col(row, 'correlation_id'));

  return {
    id: String(col(row, 'id')),
    createdAt: toISO(col(row, 'created_at')),
    updatedAt: toISO(col(row, 'updated_at')),
    entityType: String(col(row, 'entity_type')),
    entityId: String(col(row, 'entity_id')),
    level: String(col(row, 'level')) as Approval['level'],
    ...(requestedByUserId !== undefined ? { requestedByUserId } : {}),
    ...(requestedByAgentId !== undefined ? { requestedByAgentId } : {}),
    ...(approvedByUserId !== undefined ? { approvedByUserId } : {}),
    status: String(col(row, 'status')) as Approval['status'],
    ...(reason !== undefined ? { reason } : {}),
    ...(expiresAt !== undefined ? { expiresAt } : {}),
    ...(resolvedAt !== undefined ? { resolvedAt } : {}),
    ...(correlationId !== undefined ? { correlationId } : {}),
    metadata: toRecord(col(row, 'metadata')),
  };
}

export class PgApprovalStore implements ApprovalStore {
  constructor(private readonly db: SqlExecutor) {}

  async create(a: Approval): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO approvals (
        id, entity_type, entity_id, level, requested_by_user_id,
        requested_by_agent_id, approved_by_user_id, status, reason,
        expires_at, resolved_at, correlation_id, metadata, created_at, updated_at
      ) VALUES (
        ${a.id}, ${a.entityType}, ${a.entityId}, ${a.level},
        ${a.requestedByUserId ?? null}, ${a.requestedByAgentId ?? null},
        ${a.approvedByUserId ?? null}, ${a.status}, ${a.reason ?? null},
        ${a.expiresAt ?? null}, ${a.resolvedAt ?? null},
        ${a.correlationId ?? null}, ${JSON.stringify(a.metadata)}::jsonb,
        ${a.createdAt}, ${a.updatedAt}
      )
    `);
  }

  async findById(id: string): Promise<Approval | null> {
    const result = await this.db.execute(sql`SELECT * FROM approvals WHERE id = ${id}`);
    const row = firstRow<Row>(result);
    return row ? mapApproval(row) : null;
  }

  async findPending(filter: {
    entityType?: string;
    level?: ApprovalLevel;
  }): Promise<Approval[]> {
    const conditions = [sql`status = 'PENDING'`, sql`(expires_at IS NULL OR expires_at > now())`];
    if (filter.entityType) conditions.push(sql`entity_type = ${filter.entityType}`);
    if (filter.level) conditions.push(sql`level = ${filter.level}`);

    const where = sql.join(conditions, sql` AND `);
    const result = await this.db.execute(sql`
      SELECT * FROM approvals WHERE ${where} ORDER BY created_at
    `);
    return rowsOf<Row>(result).map(mapApproval);
  }

  /**
   * Moves one PENDING approval to APPROVED or REJECTED, or to EXPIRED if its
   * deadline has passed. Returns null in the expired case and when the row was
   * not PENDING, matching the in-memory store: the caller must treat null as
   * "not resolved by you".
   */
  async resolvePending(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    userId: string,
    reason?: string
  ): Promise<Approval | null> {
    const result = await this.db.execute(sql`
      UPDATE approvals
      SET status = CASE
            WHEN expires_at IS NOT NULL AND expires_at <= now() THEN 'EXPIRED'::approval_status
            ELSE ${status}::approval_status
          END,
          approved_by_user_id = CASE
            WHEN expires_at IS NOT NULL AND expires_at <= now() THEN approved_by_user_id
            ELSE ${userId}
          END,
          reason = CASE
            WHEN expires_at IS NOT NULL AND expires_at <= now() THEN reason
            ELSE COALESCE(${reason ?? null}, reason)
          END,
          resolved_at = now(),
          updated_at = now()
      WHERE id = ${id} AND status = 'PENDING'
      RETURNING *, (status = 'EXPIRED') AS expired
    `);

    const row = firstRow<Row>(result);
    if (!row) return null;
    if (toBool(col(row, 'expired'))) return null;
    return mapApproval(row);
  }
}
