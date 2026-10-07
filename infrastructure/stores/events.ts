/**
 * Hutchrok OS — Postgres event store
 *
 * Section 4 AUDIT and the event envelope's own contract: "All events must be
 * durable enough to support replay and investigation." An in-memory publisher
 * cannot support either.
 *
 * Append-only, like the audit sink: `publish` is `ON CONFLICT (id) DO NOTHING`,
 * so republishing an event is a no-op rather than a rewrite. That also makes
 * the publisher safe to call from a retried handler.
 */

import { sql } from 'drizzle-orm';
import {
  ActivityEnvelopeSchema,
  type ActivityEnvelope,
  type EventEnvelope,
} from '@hutchrok-os/events';

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

/** The autopilot's publisher port. Also satisfied by InMemoryEventPublisher. */
export interface EventPublisher {
  publish(event: EventEnvelope): Promise<void>;
}

export interface EventQueryFilter {
  eventType?: string;
  correlationId?: string;
  entityType?: string;
  entityId?: string;
  actor?: string;
  tenantId?: string;
  channel?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

/** True when the row carries the activity-kernel columns. */
function isActivityRow(row: Row): boolean {
  return (
    toStringOptional(col(row, 'tenant_id')) !== undefined &&
    toStringOptional(col(row, 'company_id')) !== undefined &&
    toStringOptional(col(row, 'channel')) !== undefined
  );
}

function mapEvent(row: Row): EventEnvelope {
  const entityType = toStringOptional(col(row, 'entity_type'));
  const entityId = toStringOptional(col(row, 'entity_id'));
  const causationId = toStringOptional(col(row, 'causation_id'));

  const base: EventEnvelope = {
    event_id: String(col(row, 'id')),
    event_type: String(col(row, 'event_type')),
    business_id: String(col(row, 'business_id')),
    source: String(col(row, 'source')),
    actor: String(col(row, 'actor')),
    ...(entityType !== undefined ? { entity_type: entityType } : {}),
    ...(entityId !== undefined ? { entity_id: entityId } : {}),
    timestamp: toISO(col(row, 'timestamp')),
    correlation_id: String(col(row, 'correlation_id')),
    ...(causationId !== undefined ? { causation_id: causationId } : {}),
    payload: toRecord(col(row, 'payload')),
    metadata: toRecord(col(row, 'metadata')),
    risk_level: String(col(row, 'risk_level')) as EventEnvelope['risk_level'],
    schema_version: String(col(row, 'schema_version')),
  };

  if (!isActivityRow(row)) return base;

  const evidenceRef = toStringOptional(col(row, 'evidence_ref'));
  const provider = toStringOptional(col(row, 'provider'));
  const providerEventId = toStringOptional(col(row, 'provider_event_id'));
  const classification = toStringOptional(col(row, 'data_classification'));

  const candidate = {
    ...base,
    tenant_id: String(col(row, 'tenant_id')),
    company_id: String(col(row, 'company_id')),
    channel: String(col(row, 'channel')),
    data_classification: classification ?? 'INTERNAL',
    ...(evidenceRef !== undefined ? { evidence_ref: evidenceRef } : {}),
    ...(provider !== undefined ? { provider } : {}),
    ...(providerEventId !== undefined ? { provider_event_id: providerEventId } : {}),
  };

  // Only return the richer shape if it really is a valid activity; a row with
  // an unrecognised channel stays a plain event rather than a half-activity.
  const parsed = ActivityEnvelopeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : base;
}

function activityFields(event: EventEnvelope): Partial<ActivityEnvelope> {
  const parsed = ActivityEnvelopeSchema.safeParse(event);
  return parsed.success ? parsed.data : {};
}

export class PgEventStore implements EventPublisher {
  constructor(private readonly db: SqlExecutor) {}

  async publish(event: EventEnvelope): Promise<void> {
    // An ActivityEnvelope stores its tenant binding, channel and
    // classification too; a plain event leaves those columns null.
    const a = activityFields(event);

    await this.db.execute(sql`
      INSERT INTO events (
        id, event_type, business_id, source, actor, entity_type, entity_id,
        timestamp, correlation_id, causation_id, payload, metadata,
        risk_level, schema_version,
        tenant_id, company_id, channel, data_classification,
        evidence_ref, provider, provider_event_id
      ) VALUES (
        ${event.event_id}, ${event.event_type}, ${event.business_id},
        ${event.source}, ${event.actor}, ${event.entity_type ?? null},
        ${event.entity_id ?? null}, ${event.timestamp}, ${event.correlation_id},
        ${event.causation_id ?? null}, ${JSON.stringify(event.payload)}::jsonb,
        ${JSON.stringify(event.metadata)}::jsonb, ${event.risk_level},
        ${event.schema_version},
        ${a.tenant_id ?? null}, ${a.company_id ?? null}, ${a.channel ?? null},
        ${a.data_classification ?? null}, ${a.evidence_ref ?? null},
        ${a.provider ?? null}, ${a.provider_event_id ?? null}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }

  async findById(eventId: string): Promise<EventEnvelope | null> {
    const result = await this.db.execute(sql`SELECT * FROM events WHERE id = ${eventId}`);
    const row = firstRow<Row>(result);
    return row ? mapEvent(row) : null;
  }

  /** Events sharing a correlation id, oldest first — one activity's story. */
  async byCorrelation(correlationId: string): Promise<EventEnvelope[]> {
    const result = await this.db.execute(sql`
      SELECT * FROM events WHERE correlation_id = ${correlationId}
      ORDER BY timestamp, id
    `);
    return rowsOf<Row>(result).map(mapEvent);
  }

  async query(filter: EventQueryFilter): Promise<EventEnvelope[]> {
    const conditions = [sql`TRUE`];
    if (filter.eventType) conditions.push(sql`event_type = ${filter.eventType}`);
    if (filter.correlationId) conditions.push(sql`correlation_id = ${filter.correlationId}`);
    if (filter.entityType) conditions.push(sql`entity_type = ${filter.entityType}`);
    if (filter.entityId) conditions.push(sql`entity_id = ${filter.entityId}`);
    if (filter.actor) conditions.push(sql`actor = ${filter.actor}`);
    if (filter.tenantId) conditions.push(sql`tenant_id = ${filter.tenantId}`);
    if (filter.channel) conditions.push(sql`channel = ${filter.channel}`);
    if (filter.fromDate) conditions.push(sql`timestamp >= ${filter.fromDate}`);
    if (filter.toDate) conditions.push(sql`timestamp <= ${filter.toDate}`);

    const where = sql.join(conditions, sql` AND `);
    const result = await this.db.execute(sql`
      SELECT * FROM events WHERE ${where}
      ORDER BY timestamp DESC, id
      LIMIT ${filter.limit ?? 100}
    `);
    return rowsOf<Row>(result).map(mapEvent);
  }

  async count(): Promise<number> {
    const result = await this.db.execute(sql`SELECT count(*)::int AS n FROM events`);
    const row = firstRow<Row>(result);
    return row ? Number(col(row, 'n')) : 0;
  }
}
