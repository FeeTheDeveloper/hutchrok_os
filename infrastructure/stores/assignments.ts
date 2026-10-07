/**
 * Hutchrok OS — Postgres assignment store
 *
 * `transition` is a conditional UPDATE guarded by the source states, so a
 * concurrent caller cannot complete an assignment that another worker has
 * already failed, and nothing moves out of a terminal state.
 */

import { sql } from 'drizzle-orm';
import type {
  Assignment,
  AssignmentStatus,
  AssignmentStore,
  ServiceLane,
} from './types.js';
import {
  col,
  firstRow,
  rowsOf,
  toISO,
  toInt,
  toRecord,
  toStringArray,
  toStringOptional,
  type SqlExecutor,
} from './sql.js';

type Row = Record<string, unknown>;

function toUuidArray(value: unknown): string[] {
  return toStringArray(value);
}

function mapAssignment(row: Row): Assignment {
  const slaId = toStringOptional(col(row, 'sla_id'));
  const handoffTarget = toStringOptional(col(row, 'handoff_target'));
  const retry = toRecord(col(row, 'retry_policy'));

  return {
    id: String(col(row, 'id')),
    createdAt: toISO(col(row, 'created_at')),
    updatedAt: toISO(col(row, 'updated_at')),
    tenantId: String(col(row, 'tenant_id')),
    companyId: String(col(row, 'company_id')),
    objective: String(col(row, 'objective')),
    triggeringEventId: String(col(row, 'triggering_event_id')),
    agentId: String(col(row, 'agent_id')),
    controller: String(col(row, 'controller')),
    lane: String(col(row, 'lane')) as ServiceLane,
    inputs: toRecord(col(row, 'inputs')),
    evidenceRefs: toStringArray(col(row, 'evidence_refs')),
    allowedCapabilities: toStringArray(col(row, 'allowed_capabilities')),
    exclusions: toStringArray(col(row, 'exclusions')),
    classification: String(col(row, 'classification')) as Assignment['classification'],
    credentialScope: toStringArray(col(row, 'credential_scope')),
    approvalLevel: String(col(row, 'approval_level')) as Assignment['approvalLevel'],
    dependencies: toUuidArray(col(row, 'dependencies')),
    ...(slaId !== undefined ? { slaId } : {}),
    acceptanceCriteria: toStringArray(col(row, 'acceptance_criteria')),
    evidenceRequired: toStringArray(col(row, 'evidence_required')),
    ...(handoffTarget !== undefined ? { handoffTarget } : {}),
    retryPolicy: {
      maxAttempts: typeof retry['maxAttempts'] === 'number' ? retry['maxAttempts'] : 3,
      backoffMs: typeof retry['backoffMs'] === 'number' ? retry['backoffMs'] : 30_000,
    },
    exceptionOwner: String(col(row, 'exception_owner')),
    status: String(col(row, 'status')) as AssignmentStatus,
    attempts: toInt(col(row, 'attempts')),
    correlationId: String(col(row, 'correlation_id')),
    metadata: toRecord(col(row, 'metadata')),
  };
}

export class PgAssignmentStore implements AssignmentStore {
  constructor(private readonly db: SqlExecutor) {}

  async create(a: Assignment): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO assignments (
        id, tenant_id, company_id, objective, triggering_event_id, agent_id,
        controller, lane, inputs, evidence_refs, allowed_capabilities, exclusions,
        classification, credential_scope, approval_level, dependencies, sla_id,
        acceptance_criteria, evidence_required, handoff_target, retry_policy,
        exception_owner, status, attempts, correlation_id, metadata,
        created_at, updated_at
      ) VALUES (
        ${a.id}, ${a.tenantId}, ${a.companyId}, ${a.objective}, ${a.triggeringEventId},
        ${a.agentId}, ${a.controller}, ${a.lane},
        ${JSON.stringify(a.inputs)}::jsonb,
        ${JSON.stringify(a.evidenceRefs)}::jsonb,
        ${JSON.stringify(a.allowedCapabilities)}::jsonb,
        ${JSON.stringify(a.exclusions)}::jsonb,
        ${a.classification}, ${JSON.stringify(a.credentialScope)}::jsonb,
        ${a.approvalLevel}, ${JSON.stringify(a.dependencies)}::jsonb, ${a.slaId ?? null},
        ${JSON.stringify(a.acceptanceCriteria)}::jsonb,
        ${JSON.stringify(a.evidenceRequired)}::jsonb,
        ${a.handoffTarget ?? null}, ${JSON.stringify(a.retryPolicy)}::jsonb,
        ${a.exceptionOwner}, ${a.status}, ${a.attempts}, ${a.correlationId},
        ${JSON.stringify(a.metadata)}::jsonb, ${a.createdAt}, ${a.updatedAt}
      )
    `);
  }

  async findById(id: string): Promise<Assignment | null> {
    const result = await this.db.execute(sql`SELECT * FROM assignments WHERE id = ${id}`);
    const row = firstRow<Row>(result);
    return row ? mapAssignment(row) : null;
  }

  async list(filter: {
    status?: AssignmentStatus;
    lane?: ServiceLane;
    agentId?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<Assignment[]> {
    const conditions = [sql`TRUE`];
    if (filter.status) conditions.push(sql`status = ${filter.status}`);
    if (filter.lane) conditions.push(sql`lane = ${filter.lane}`);
    if (filter.agentId) conditions.push(sql`agent_id = ${filter.agentId}`);
    if (filter.tenantId) conditions.push(sql`tenant_id = ${filter.tenantId}`);

    const where = sql.join(conditions, sql` AND `);
    const limit = filter.limit ? sql`LIMIT ${filter.limit}` : sql``;

    const result = await this.db.execute(sql`
      SELECT * FROM assignments WHERE ${where} ORDER BY created_at ${limit}
    `);
    return rowsOf<Row>(result).map(mapAssignment);
  }

  async transition(
    id: string,
    from: AssignmentStatus[],
    to: AssignmentStatus,
    patch: Partial<Assignment>
  ): Promise<Assignment | null> {
    const fromList = sql.join(
      from.map((s) => sql`${s}`),
      sql`, `
    );

    // Metadata merges rather than replaces, matching the in-memory store.
    const metadataExpr =
      patch.metadata !== undefined
        ? sql`metadata || ${JSON.stringify(patch.metadata)}::jsonb`
        : sql`metadata`;

    const evidenceExpr =
      patch.evidenceRefs !== undefined
        ? sql`${JSON.stringify(patch.evidenceRefs)}::jsonb`
        : sql`evidence_refs`;

    const result = await this.db.execute(sql`
      UPDATE assignments
      SET status        = ${to},
          attempts      = ${patch.attempts ?? sql`attempts`},
          evidence_refs = ${evidenceExpr},
          metadata      = ${metadataExpr},
          updated_at    = ${patch.updatedAt ?? sql`now()`}
      WHERE id = ${id} AND status IN (${fromList})
      RETURNING *
    `);

    const row = firstRow<Row>(result);
    return row ? mapAssignment(row) : null;
  }
}
