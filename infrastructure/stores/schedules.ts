/**
 * Hutchrok OS — Postgres scheduled action store
 *
 * Two statements carry the guarantees:
 *
 *   insertUnique — ON CONFLICT (tenant_id, idempotency_key) DO NOTHING, so a
 *                  re-requested follow-up collapses onto the existing row.
 *   claimDue     — a CTE with FOR UPDATE SKIP LOCKED, so N workers polling the
 *                  same due row hand it to exactly one of them and the rest
 *                  move on instead of blocking.
 */

import { sql } from 'drizzle-orm';
import type { ScheduleStore, ScheduledAction, ScheduledActionStatus } from './types.js';
import {
  col,
  firstRow,
  rowsOf,
  toISO,
  toISOOptional,
  toInt,
  toRecord,
  toStringOptional,
  type SqlExecutor,
} from './sql.js';

type Row = Record<string, unknown>;

function mapAction(row: Row): ScheduledAction {
  const lockedUntil = toISOOptional(col(row, 'locked_until'));
  const lockedBy = toStringOptional(col(row, 'locked_by'));
  const lastError = toStringOptional(col(row, 'last_error'));
  const assignmentId = toStringOptional(col(row, 'assignment_id'));

  return {
    id: String(col(row, 'id')),
    createdAt: toISO(col(row, 'created_at')),
    updatedAt: toISO(col(row, 'updated_at')),
    tenantId: String(col(row, 'tenant_id')),
    companyId: String(col(row, 'company_id')),
    kind: String(col(row, 'kind')),
    dueAt: toISO(col(row, 'due_at')),
    payload: toRecord(col(row, 'payload')),
    status: String(col(row, 'status')) as ScheduledActionStatus,
    ...(lockedUntil !== undefined ? { lockedUntil } : {}),
    ...(lockedBy !== undefined ? { lockedBy } : {}),
    attempts: toInt(col(row, 'attempts')),
    maxAttempts: toInt(col(row, 'max_attempts')),
    ...(lastError !== undefined ? { lastError } : {}),
    ...(assignmentId !== undefined ? { assignmentId } : {}),
    idempotencyKey: String(col(row, 'idempotency_key')),
    correlationId: String(col(row, 'correlation_id')),
    metadata: toRecord(col(row, 'metadata')),
  };
}

export class PgScheduleStore implements ScheduleStore {
  constructor(private readonly db: SqlExecutor) {}

  async insertUnique(
    action: ScheduledAction
  ): Promise<{ created: boolean; action: ScheduledAction }> {
    const inserted = await this.db.execute(sql`
      INSERT INTO scheduled_actions (
        id, tenant_id, company_id, kind, due_at, payload, status,
        attempts, max_attempts, assignment_id, idempotency_key, correlation_id,
        metadata, created_at, updated_at
      ) VALUES (
        ${action.id}, ${action.tenantId}, ${action.companyId}, ${action.kind},
        ${action.dueAt}, ${JSON.stringify(action.payload)}::jsonb, ${action.status},
        ${action.attempts}, ${action.maxAttempts}, ${action.assignmentId ?? null},
        ${action.idempotencyKey}, ${action.correlationId},
        ${JSON.stringify(action.metadata)}::jsonb, ${action.createdAt}, ${action.updatedAt}
      )
      ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
      RETURNING *
    `);

    const row = firstRow<Row>(inserted);
    if (row) return { created: true, action: mapAction(row) };

    // The conflict target already held a row — return it, unchanged.
    const existing = await this.db.execute(sql`
      SELECT * FROM scheduled_actions
      WHERE tenant_id = ${action.tenantId} AND idempotency_key = ${action.idempotencyKey}
    `);
    const existingRow = firstRow<Row>(existing);
    if (!existingRow) {
      throw new Error(
        `Insert of ${action.idempotencyKey} conflicted but no existing row was found.`
      );
    }
    return { created: false, action: mapAction(existingRow) };
  }

  async findById(id: string): Promise<ScheduledAction | null> {
    const result = await this.db.execute(sql`
      SELECT * FROM scheduled_actions WHERE id = ${id}
    `);
    const row = firstRow<Row>(result);
    return row ? mapAction(row) : null;
  }

  async claimDue(opts: {
    nowISO: string;
    limit: number;
    lockedBy: string;
    lockedUntil: string;
    tenantId?: string;
  }): Promise<ScheduledAction[]> {
    const tenantFilter = opts.tenantId
      ? sql`AND tenant_id = ${opts.tenantId}`
      : sql``;

    const result = await this.db.execute(sql`
      WITH due AS (
        SELECT id FROM scheduled_actions
        WHERE due_at <= ${opts.nowISO}
          ${tenantFilter}
          AND (
            status = 'PENDING'
            OR (status = 'CLAIMED' AND (locked_until IS NULL OR locked_until <= ${opts.nowISO}))
          )
        ORDER BY due_at
        LIMIT ${opts.limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE scheduled_actions s
      SET status       = 'CLAIMED',
          locked_by    = ${opts.lockedBy},
          locked_until = ${opts.lockedUntil},
          updated_at   = ${opts.nowISO}
      FROM due
      WHERE s.id = due.id
      RETURNING s.*
    `);

    return rowsOf<Row>(result).map(mapAction);
  }

  async transition(
    id: string,
    from: ScheduledActionStatus[],
    to: ScheduledActionStatus,
    patch: Partial<ScheduledAction>
  ): Promise<ScheduledAction | null> {
    // A patch that explicitly carries `lockedUntil: undefined` releases the
    // lease; one that omits the key leaves it alone.
    const releasesLease = 'lockedUntil' in patch && patch.lockedUntil === undefined;
    const releasesHolder = 'lockedBy' in patch && patch.lockedBy === undefined;

    // `IN ${array}` would bind one array parameter; build the value list.
    const fromList = sql.join(
      from.map((s) => sql`${s}`),
      sql`, `
    );

    const result = await this.db.execute(sql`
      UPDATE scheduled_actions
      SET status       = ${to},
          attempts     = ${patch.attempts ?? sql`attempts`},
          last_error   = ${patch.lastError ?? sql`last_error`},
          locked_until = ${releasesLease ? sql`NULL` : (patch.lockedUntil ?? sql`locked_until`)},
          locked_by    = ${releasesHolder ? sql`NULL` : (patch.lockedBy ?? sql`locked_by`)},
          updated_at   = ${patch.updatedAt ?? sql`now()`}
      WHERE id = ${id} AND status IN (${fromList})
      RETURNING *
    `);

    const row = firstRow<Row>(result);
    return row ? mapAction(row) : null;
  }

  async list(filter: {
    status?: ScheduledActionStatus;
    kind?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<ScheduledAction[]> {
    const conditions = [sql`TRUE`];
    if (filter.status) conditions.push(sql`status = ${filter.status}`);
    if (filter.kind) conditions.push(sql`kind = ${filter.kind}`);
    if (filter.tenantId) conditions.push(sql`tenant_id = ${filter.tenantId}`);

    const where = sql.join(conditions, sql` AND `);
    const limit = filter.limit ? sql`LIMIT ${filter.limit}` : sql``;

    const result = await this.db.execute(sql`
      SELECT * FROM scheduled_actions WHERE ${where} ORDER BY due_at ${limit}
    `);
    return rowsOf<Row>(result).map(mapAction);
  }
}
