/**
 * Hutchrok OS — Activity Kernel Schema (Drizzle ORM / PostgreSQL)
 *
 * Section 12: idempotency and replay protection are enforced here, not only
 * in application code. The unique indexes below are what actually make a
 * retried webhook delivery incapable of producing a second action — without
 * them, two concurrent deliveries can both read "not seen" and both act.
 *
 * Imports enums and parent tables from ./schema.ts. Nothing here is
 * re-exported from that file, to keep the module graph acyclic; drizzle.config.ts
 * lists both files.
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import {
  dataClassificationEnum,
  approvalLevelEnum,
  riskLevelEnum,
  channelEnum,
  deploymentEnvironmentEnum,
  persons,
  customers,
  messages,
} from './schema.js';

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────

export const serviceLaneEnum = pgEnum('service_lane', [
  'free_filing',
  'contact_consultation',
  'membership',
  'filing_tracking',
  'registered_agent_compliance',
  'launch_services',
  'govcon',
  'research_marketing',
  'website_signal',
]);

export const assignmentStatusEnum = pgEnum('assignment_status', [
  'PENDING',
  'IN_PROGRESS',
  'AWAITING_APPROVAL',
  'BLOCKED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export const exceptionReasonEnum = pgEnum('exception_reason', [
  'TENANT_BINDING_UNRESOLVED',
  'POLICY_DENIED',
  'APPROVAL_REQUIRED',
  'APPROVAL_REJECTED',
  'PROVIDER_FAILURE',
  'PROVIDER_TIMEOUT',
  'EVIDENCE_MISSING',
  'SIGNATURE_INVALID',
  'CREDENTIAL_REVOKED',
  'RESTRICTED_DATA_BLOCKED',
  'UNSUPPORTED_REQUEST',
  'AGENT_ERROR',
  'SLA_BREACHED',
]);

export const exceptionStatusEnum = pgEnum('exception_status', [
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
  'DEAD_LETTER',
]);

export const scheduledActionStatusEnum = pgEnum('scheduled_action_status', [
  'PENDING',
  'CLAIMED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export const slaStatusEnum = pgEnum('sla_status', [
  'ACTIVE',
  'SATISFIED',
  'BREACHED',
  'CANCELLED',
]);

export const consentStateEnum = pgEnum('consent_state', ['GRANTED', 'REVOKED', 'UNKNOWN']);

export const contactPointKindEnum = pgEnum('contact_point_kind', [
  'email',
  'phone',
  'social',
  'postal',
]);

export const scanStatusEnum = pgEnum('scan_status', ['PENDING', 'CLEAN', 'INFECTED', 'FAILED']);

// ─────────────────────────────────────────
// PROVIDER EVENT RECEIPTS
// ─────────────────────────────────────────

/**
 * Webhook idempotency. The unique index on (provider, provider_event_id) is
 * the enforcement point: concurrent deliveries of the same provider event
 * cannot both insert, so only one caller is ever told it may act.
 */
export const providerEventReceipts = pgTable(
  'provider_event_receipts',
  {
    id: uuid('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    companyId: text('company_id').notNull(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    payloadHash: text('payload_hash').notNull(),
    signatureVerified: boolean('signature_verified').notNull().default(false),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull(),
    replayCount: integer('replay_count').notNull().default(0),
    activityEventId: uuid('activity_event_id'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerEventUnique: uniqueIndex('provider_event_receipts_provider_event_uq').on(
      t.provider,
      t.providerEventId
    ),
    idempotencyUnique: uniqueIndex('provider_event_receipts_idempotency_uq').on(t.idempotencyKey),
    tenantIdx: index('provider_event_receipts_tenant_idx').on(t.tenantId, t.receivedAt),
  })
);

// ─────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────

export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    companyId: text('company_id').notNull(),
    objective: text('objective').notNull(),
    triggeringEventId: uuid('triggering_event_id').notNull(),
    agentId: text('agent_id').notNull(),
    controller: text('controller').notNull(),
    lane: serviceLaneEnum('lane').notNull(),
    inputs: jsonb('inputs').notNull().default({}),
    evidenceRefs: jsonb('evidence_refs').notNull().default([]),
    allowedCapabilities: jsonb('allowed_capabilities').notNull().default([]),
    exclusions: jsonb('exclusions').notNull().default([]),
    classification: dataClassificationEnum('classification').notNull().default('INTERNAL'),
    credentialScope: jsonb('credential_scope').notNull().default([]),
    approvalLevel: approvalLevelEnum('approval_level').notNull().default('A'),
    dependencies: jsonb('dependencies').notNull().default([]),
    slaId: uuid('sla_id'),
    acceptanceCriteria: jsonb('acceptance_criteria').notNull().default([]),
    evidenceRequired: jsonb('evidence_required').notNull().default([]),
    handoffTarget: text('handoff_target'),
    retryPolicy: jsonb('retry_policy').notNull().default({ maxAttempts: 3, backoffMs: 30000 }),
    exceptionOwner: text('exception_owner').notNull(),
    status: assignmentStatusEnum('status').notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    correlationId: text('correlation_id').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index('assignments_tenant_status_idx').on(t.tenantId, t.status),
    laneIdx: index('assignments_lane_idx').on(t.lane, t.status),
    agentIdx: index('assignments_agent_idx').on(t.agentId, t.status),
    correlationIdx: index('assignments_correlation_idx').on(t.correlationId),
  })
);

// ─────────────────────────────────────────
// EXCEPTION QUEUE
// ─────────────────────────────────────────

export const exceptionQueue = pgTable(
  'exception_queue',
  {
    id: uuid('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    companyId: text('company_id').notNull(),
    reason: exceptionReasonEnum('reason').notNull(),
    severity: riskLevelEnum('severity').notNull().default('MEDIUM'),
    summary: text('summary').notNull(),
    detail: text('detail'),
    assignmentId: uuid('assignment_id').references(() => assignments.id),
    activityEventId: uuid('activity_event_id'),
    ownerRole: text('owner_role').notNull(),
    status: exceptionStatusEnum('status').notNull().default('OPEN'),
    evidenceRefs: jsonb('evidence_refs').notNull().default([]),
    attempts: integer('attempts').notNull().default(0),
    acknowledgedBy: text('acknowledged_by'),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolution: text('resolution'),
    correlationId: text('correlation_id').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    openIdx: index('exception_queue_open_idx').on(t.status, t.severity, t.createdAt),
    ownerIdx: index('exception_queue_owner_idx').on(t.ownerRole, t.status),
    tenantIdx: index('exception_queue_tenant_idx').on(t.tenantId, t.status),
  })
);

// ─────────────────────────────────────────
// SCHEDULED ACTIONS
// ─────────────────────────────────────────

/**
 * Follow-ups, deadlines, reminders. (tenant_id, idempotency_key) is unique so
 * re-requesting the same logical follow-up does not queue it twice.
 */
export const scheduledActions = pgTable(
  'scheduled_actions',
  {
    id: uuid('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    companyId: text('company_id').notNull(),
    kind: text('kind').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    status: scheduledActionStatusEnum('status').notNull().default('PENDING'),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lockedBy: text('locked_by'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    lastError: text('last_error'),
    assignmentId: uuid('assignment_id').references(() => assignments.id),
    idempotencyKey: text('idempotency_key').notNull(),
    correlationId: text('correlation_id').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idempotencyUnique: uniqueIndex('scheduled_actions_tenant_idempotency_uq').on(
      t.tenantId,
      t.idempotencyKey
    ),
    dueIdx: index('scheduled_actions_due_idx').on(t.status, t.dueAt),
    kindIdx: index('scheduled_actions_kind_idx').on(t.kind, t.status),
  })
);

// ─────────────────────────────────────────
// SLA RECORDS
// ─────────────────────────────────────────

export const slaRecords = pgTable(
  'sla_records',
  {
    id: uuid('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    companyId: text('company_id').notNull(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id),
    lane: serviceLaneEnum('lane').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    satisfiedAt: timestamp('satisfied_at', { withTimezone: true }),
    breachedAt: timestamp('breached_at', { withTimezone: true }),
    status: slaStatusEnum('status').notNull().default('ACTIVE'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index('sla_records_active_idx').on(t.status, t.dueAt),
    assignmentIdx: index('sla_records_assignment_idx').on(t.assignmentId),
  })
);

// ─────────────────────────────────────────
// CREDENTIAL BINDINGS
// ─────────────────────────────────────────

/**
 * Secret *references* only. No column here may hold secret material — see
 * CredentialBindingSchema in @hutchrok-os/domain for the parse-time guard.
 */
export const credentialBindings = pgTable(
  'credential_bindings',
  {
    id: uuid('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    companyId: text('company_id').notNull(),
    provider: text('provider').notNull(),
    secretRef: text('secret_ref').notNull(),
    scopes: jsonb('scopes').notNull().default([]),
    environment: deploymentEnvironmentEnum('environment').notNull(),
    accountRef: text('account_ref'),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    classification: dataClassificationEnum('classification').notNull().default('SECRET'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    scopeUnique: uniqueIndex('credential_bindings_scope_uq').on(
      t.tenantId,
      t.provider,
      t.environment
    ),
  })
);

// ─────────────────────────────────────────
// CONTACT POINTS / CONSENT
// ─────────────────────────────────────────

export const contactPoints = pgTable(
  'contact_points',
  {
    id: uuid('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    companyId: text('company_id').notNull(),
    kind: contactPointKindEnum('kind').notNull(),
    value: text('value').notNull(),
    personId: uuid('person_id').references(() => persons.id),
    customerId: uuid('customer_id').references(() => customers.id),
    verified: boolean('verified').notNull().default(false),
    classification: dataClassificationEnum('classification').notNull().default('INTERNAL'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    valueUnique: uniqueIndex('contact_points_tenant_kind_value_uq').on(t.tenantId, t.kind, t.value),
    personIdx: index('contact_points_person_idx').on(t.personId),
  })
);

/** Consent/opt-out state per contact point and channel. */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: uuid('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    companyId: text('company_id').notNull(),
    contactPointId: uuid('contact_point_id')
      .notNull()
      .references(() => contactPoints.id),
    channel: channelEnum('channel').notNull(),
    state: consentStateEnum('state').notNull().default('UNKNOWN'),
    basis: text('basis'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    source: text('source').notNull(),
    evidenceRef: text('evidence_ref'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    currentUnique: uniqueIndex('consent_records_point_channel_uq').on(t.contactPointId, t.channel),
  })
);

// ─────────────────────────────────────────
// ATTACHMENT EVIDENCE
// ─────────────────────────────────────────

export const attachmentEvidence = pgTable(
  'attachment_evidence',
  {
    id: uuid('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    companyId: text('company_id').notNull(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    bytes: integer('bytes').notNull(),
    storageRef: text('storage_ref').notNull(),
    sha256: text('sha256').notNull(),
    classification: dataClassificationEnum('classification').notNull().default('CONFIDENTIAL'),
    scanStatus: scanStatusEnum('scan_status').notNull().default('PENDING'),
    activityEventId: uuid('activity_event_id'),
    messageId: uuid('message_id').references(() => messages.id),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    hashIdx: index('attachment_evidence_hash_idx').on(t.sha256),
    scanIdx: index('attachment_evidence_scan_idx').on(t.scanStatus),
  })
);
