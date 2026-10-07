/**
 * Hutchrok OS — Postgres exception queue store
 *
 * `transition` is guarded by the source states so an item cannot be resolved
 * twice, and a dead-lettered item cannot be quietly reopened.
 */

import { sql } from 'drizzle-orm';
import type {
  ExceptionQueueItem,
  ExceptionReason,
  ExceptionStatus,
  ExceptionStore,
} from './types.js';
import {
  col,
  firstRow,
  rowsOf,
  toISO,
  toISOOptional,
  toInt,
  toRecord,
  toStringArray,
  toStringOptional,
  type SqlExecutor,
} from './sql.js';

type Row = Record<string, unknown>;

function mapItem(row: Row): ExceptionQueueItem {
  const detail = toStringOptional(col(row, 'detail'));
  const assignmentId = toStringOptional(col(row, 'assignment_id'));
  const activityEventId = toStringOptional(col(row, 'activity_event_id'));
  const acknowledgedBy = toStringOptional(col(row, 'acknowledged_by'));
  const acknowledgedAt = toISOOptional(col(row, 'acknowledged_at'));
  const resolvedBy = toStringOptional(col(row, 'resolved_by'));
  const resolvedAt = toISOOptional(col(row, 'resolved_at'));
  const resolution = toStringOptional(col(row, 'resolution'));

  return {
    id: String(col(row, 'id')),
    createdAt: toISO(col(row, 'created_at')),
    updatedAt: toISO(col(row, 'updated_at')),
    tenantId: String(col(row, 'tenant_id')),
    companyId: String(col(row, 'company_id')),
    reason: String(col(row, 'reason')) as ExceptionReason,
    severity: String(col(row, 'severity')) as ExceptionQueueItem['severity'],
    summary: String(col(row, 'summary')),
    ...(detail !== undefined ? { detail } : {}),
    ...(assignmentId !== undefined ? { assignmentId } : {}),
    ...(activityEventId !== undefined ? { activityEventId } : {}),
    ownerRole: String(col(row, 'owner_role')),
    status: String(col(row, 'status')) as ExceptionStatus,
    evidenceRefs: toStringArray(col(row, 'evidence_refs')),
    attempts: toInt(col(row, 'attempts')),
    ...(acknowledgedBy !== undefined ? { acknowledgedBy } : {}),
    ...(acknowledgedAt !== undefined ? { acknowledgedAt } : {}),
    ...(resolvedBy !== undefined ? { resolvedBy } : {}),
    ...(resolvedAt !== undefined ? { resolvedAt } : {}),
    ...(resolution !== undefined ? { resolution } : {}),
    correlationId: String(col(row, 'correlation_id')),
    metadata: toRecord(col(row, 'metadata')),
  };
}

export class PgExceptionStore implements ExceptionStore {
  constructor(private readonly db: SqlExecutor) {}

  async create(i: ExceptionQueueItem): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO exception_queue (
        id, tenant_id, company_id, reason, severity, summary, detail,
        assignment_id, activity_event_id, owner_role, status, evidence_refs,
        attempts, correlation_id, metadata, created_at, updated_at
      ) VALUES (
        ${i.id}, ${i.tenantId}, ${i.companyId}, ${i.reason}, ${i.severity},
        ${i.summary}, ${i.detail ?? null}, ${i.assignmentId ?? null},
        ${i.activityEventId ?? null}, ${i.ownerRole}, ${i.status},
        ${JSON.stringify(i.evidenceRefs)}::jsonb, ${i.attempts},
        ${i.correlationId}, ${JSON.stringify(i.metadata)}::jsonb,
        ${i.createdAt}, ${i.updatedAt}
      )
    `);
  }

  async findById(id: string): Promise<ExceptionQueueItem | null> {
    const result = await this.db.execute(sql`
      SELECT * FROM exception_queue WHERE id = ${id}
    `);
    const row = firstRow<Row>(result);
    return row ? mapItem(row) : null;
  }

  async list(filter: {
    status?: ExceptionStatus;
    reason?: ExceptionReason;
    ownerRole?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<ExceptionQueueItem[]> {
    const conditions = [sql`TRUE`];
    if (filter.status) conditions.push(sql`status = ${filter.status}`);
    if (filter.reason) conditions.push(sql`reason = ${filter.reason}`);
    if (filter.ownerRole) conditions.push(sql`owner_role = ${filter.ownerRole}`);
    if (filter.tenantId) conditions.push(sql`tenant_id = ${filter.tenantId}`);

    const where = sql.join(conditions, sql` AND `);
    const limit = filter.limit ? sql`LIMIT ${filter.limit}` : sql``;

    const result = await this.db.execute(sql`
      SELECT * FROM exception_queue WHERE ${where} ORDER BY created_at ${limit}
    `);
    return rowsOf<Row>(result).map(mapItem);
  }

  async transition(
    id: string,
    from: ExceptionStatus[],
    to: ExceptionStatus,
    patch: Partial<ExceptionQueueItem>
  ): Promise<ExceptionQueueItem | null> {
    const fromList = sql.join(
      from.map((s) => sql`${s}`),
      sql`, `
    );

    const result = await this.db.execute(sql`
      UPDATE exception_queue
      SET status          = ${to},
          severity        = ${patch.severity ?? sql`severity`},
          detail          = ${patch.detail ?? sql`detail`},
          acknowledged_by = ${patch.acknowledgedBy ?? sql`acknowledged_by`},
          acknowledged_at = ${patch.acknowledgedAt ?? sql`acknowledged_at`},
          resolved_by     = ${patch.resolvedBy ?? sql`resolved_by`},
          resolved_at     = ${patch.resolvedAt ?? sql`resolved_at`},
          resolution      = ${patch.resolution ?? sql`resolution`},
          updated_at      = ${patch.updatedAt ?? sql`now()`}
      WHERE id = ${id} AND status IN (${fromList})
      RETURNING *
    `);

    const row = firstRow<Row>(result);
    return row ? mapItem(row) : null;
  }
}
