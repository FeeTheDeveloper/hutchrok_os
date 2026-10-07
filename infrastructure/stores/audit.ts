/**
 * Hutchrok OS — Postgres audit sink
 *
 * CLAUDE.md forbids removing or weakening audit logging, and Section 12
 * requires an append-oriented trail for decisions, approvals, sends, filings,
 * publications, payments and credential events. Until now that trail lived in
 * memory and evaporated on restart.
 *
 * Append-only in behaviour: this class offers no update and no delete, and
 * `append` uses `ON CONFLICT (id) DO NOTHING` so a retried write cannot
 * rewrite history — a replayed append is a no-op, never an overwrite.
 */

import { sql } from 'drizzle-orm';
import type { AuditLog } from '@hutchrok-os/domain';
import type { AuditQueryFilter, AuditSink } from '@hutchrok-os/audit';

import {
  col,
  firstRow,
  rowsOf,
  toISO,
  toRecord,
  toStringOptional,
  type SqlExecutor,
} from './sql.js';

type Row = Record<string, unknown>;

/** jsonb that is legitimately absent, as distinct from an empty object. */
function toRecordOptional(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined;
  return toRecord(value);
}

function mapAudit(row: Row): AuditLog {
  const entityType = toStringOptional(col(row, 'entity_type'));
  const entityId = toStringOptional(col(row, 'entity_id'));
  const before = toRecordOptional(col(row, 'before'));
  const after = toRecordOptional(col(row, 'after'));
  const errorMessage = toStringOptional(col(row, 'error_message'));
  const correlationId = toStringOptional(col(row, 'correlation_id'));
  const causationId = toStringOptional(col(row, 'causation_id'));
  const source = toStringOptional(col(row, 'source'));
  const ipAddress = toStringOptional(col(row, 'ip_address'));

  return {
    id: String(col(row, 'id')),
    createdAt: toISO(col(row, 'created_at')),
    updatedAt: toISO(col(row, 'updated_at')),
    actor: String(col(row, 'actor')),
    actorType: String(col(row, 'actor_type')) as AuditLog['actorType'],
    actionType: String(col(row, 'action_type')),
    ...(entityType !== undefined ? { entityType } : {}),
    ...(entityId !== undefined ? { entityId } : {}),
    ...(before !== undefined ? { before } : {}),
    ...(after !== undefined ? { after } : {}),
    result: String(col(row, 'result')) as AuditLog['result'],
    ...(errorMessage !== undefined ? { errorMessage } : {}),
    ...(correlationId !== undefined ? { correlationId } : {}),
    ...(causationId !== undefined ? { causationId } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(ipAddress !== undefined ? { ipAddress } : {}),
    metadata: toRecord(col(row, 'metadata')),
  };
}

export class PgAuditSink implements AuditSink {
  constructor(private readonly db: SqlExecutor) {}

  async append(record: AuditLog): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO audit_logs (
        id, actor, actor_type, action_type, entity_type, entity_id,
        before, after, result, error_message, correlation_id, causation_id,
        source, ip_address, metadata, created_at, updated_at
      ) VALUES (
        ${record.id}, ${record.actor}, ${record.actorType}, ${record.actionType},
        ${record.entityType ?? null}, ${record.entityId ?? null},
        ${record.before === undefined ? null : JSON.stringify(record.before)}::jsonb,
        ${record.after === undefined ? null : JSON.stringify(record.after)}::jsonb,
        ${record.result}, ${record.errorMessage ?? null},
        ${record.correlationId ?? null}, ${record.causationId ?? null},
        ${record.source ?? null}, ${record.ipAddress ?? null},
        ${JSON.stringify(record.metadata)}::jsonb,
        ${record.createdAt}, ${record.updatedAt}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  async query(filter: AuditQueryFilter): Promise<AuditLog[]> {
    const conditions = [sql`TRUE`];
    if (filter.actor) conditions.push(sql`actor = ${filter.actor}`);
    if (filter.actionType) conditions.push(sql`action_type = ${filter.actionType}`);
    if (filter.entityType) conditions.push(sql`entity_type = ${filter.entityType}`);
    if (filter.entityId) conditions.push(sql`entity_id = ${filter.entityId}`);
    if (filter.correlationId) conditions.push(sql`correlation_id = ${filter.correlationId}`);
    if (filter.fromDate) conditions.push(sql`created_at >= ${filter.fromDate}`);
    if (filter.toDate) conditions.push(sql`created_at <= ${filter.toDate}`);

    const where = sql.join(conditions, sql` AND `);
    const result = await this.db.execute(sql`
      SELECT * FROM audit_logs WHERE ${where}
      ORDER BY created_at DESC, id
      LIMIT ${filter.limit ?? 100}
    `);
    return rowsOf<Row>(result).map(mapAudit);
  }

  /** Total rows, for operators verifying the trail is actually being written. */
  async count(): Promise<number> {
    const result = await this.db.execute(sql`SELECT count(*)::int AS n FROM audit_logs`);
    const row = firstRow<Row>(result);
    return row ? Number(col(row, 'n')) : 0;
  }
}
