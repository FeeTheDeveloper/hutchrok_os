/**
 * Hutchrok OS — Core Database Schema (Drizzle ORM / PostgreSQL)
 *
 * All IDs are UUIDs generated at the application layer.
 * Sensitive fields (SSN, EIN, etc.) are NOT stored in plain columns.
 * Use field-level encryption for RESTRICTED/SECRET values.
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  real,
  timestamp,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────

export const dataClassificationEnum = pgEnum('data_classification', [
  'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED', 'SECRET',
]);

export const customerStatusEnum = pgEnum('customer_status', [
  'LEAD', 'PROSPECT', 'ACTIVE', 'INACTIVE', 'CHURNED', 'BLOCKED',
]);

export const approvalLevelEnum = pgEnum('approval_level', ['A', 'B', 'C', 'D']);

export const approvalStatusEnum = pgEnum('approval_status', [
  'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'AUTO_APPROVED',
]);

export const messageDirectionEnum = pgEnum('message_direction', ['INBOUND', 'OUTBOUND']);

export const channelEnum = pgEnum('channel', [
  'email', 'sms', 'voice', 'voicemail', 'website_chat', 'social', 'internal',
]);

export const riskLevelEnum = pgEnum('risk_level', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const knowledgeTypeEnum = pgEnum('knowledge_type', [
  'POLICY', 'SOP', 'BUSINESS_FACT', 'SERVICE', 'PRICING', 'CUSTOMER_PATTERN',
  'MARKETING_INSIGHT', 'GOVCON_INTELLIGENCE', 'TECHNICAL', 'LEGAL_BOUNDARY',
  'OWNER_DECISION', 'BRAND_RULE',
]);

export const knowledgeStatusEnum = pgEnum('knowledge_status', [
  'DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED',
]);

export const deploymentEnvironmentEnum = pgEnum('deployment_environment', [
  'local', 'dev', 'preview', 'staging', 'production',
]);

export const deploymentStatusEnum = pgEnum('deployment_status', [
  'PENDING', 'BUILDING', 'PREVIEW_READY', 'APPROVED', 'DEPLOYING',
  'DEPLOYED', 'FAILED', 'ROLLED_BACK',
]);

export const actorTypeEnum = pgEnum('actor_type', ['USER', 'AGENT', 'SYSTEM', 'CONNECTOR']);

export const auditResultEnum = pgEnum('audit_result', ['SUCCESS', 'FAILURE', 'PARTIAL']);

export const alertSeverityEnum = pgEnum('alert_severity', ['INFO', 'WARNING', 'ERROR', 'CRITICAL']);

export const veteranFilingStateEnum = pgEnum('veteran_filing_state', [
  'LEAD', 'ELIGIBILITY_REVIEW', 'ELIGIBLE', 'VVL_VERIFICATION', 'INTAKE_PENDING',
  'INTAKE_COMPLETE', 'DOCUMENT_COLLECTION', 'FILING_PREPARATION', 'INTERNAL_REVIEW',
  'CUSTOMER_APPROVAL', 'READY_TO_FILE', 'SUBMITTED', 'STATE_REVIEW', 'APPROVED',
  'REJECTED', 'CORRECTION_REQUIRED', 'RESUBMITTED', 'DOCUMENT_DELIVERY',
  'FORMATION_COMPLETE', 'POST_FORMATION', 'BUSINESS_LAUNCH', 'CANCELLED',
]);

// ─────────────────────────────────────────
// PERSONS
// ─────────────────────────────────────────

export const persons = pgTable('persons', {
  id: uuid('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  isVeteran: boolean('is_veteran').notNull().default(false),
  veteranVerified: boolean('veteran_verified').notNull().default(false),
  classification: dataClassificationEnum('classification').notNull().default('INTERNAL'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// ORGANIZATIONS
// ─────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey(),
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name'),
  entityType: text('entity_type'),
  stateOfFormation: text('state_of_formation'),
  einEncrypted: text('ein_encrypted'), // RESTRICTED — encrypted at application layer
  website: text('website'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  isActive: boolean('is_active').notNull().default(true),
  classification: dataClassificationEnum('classification').notNull().default('INTERNAL'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// ORGANIZATION MEMBERS
// ─────────────────────────────────────────

export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  personId: uuid('person_id').notNull().references(() => persons.id),
  role: text('role').notNull(),
  title: text('title'),
  isPrimary: boolean('is_primary').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey(),
  personId: uuid('person_id').notNull().references(() => persons.id),
  organizationId: uuid('organization_id').references(() => organizations.id),
  status: customerStatusEnum('status').notNull().default('LEAD'),
  customerClass: text('customer_class').notNull(),
  ownedByUserId: uuid('owned_by_user_id'),
  source: text('source'),
  notes: text('notes'),
  tags: jsonb('tags').notNull().default([]),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// CASES
// ─────────────────────────────────────────

export const cases = pgTable('cases', {
  id: uuid('id').primaryKey(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  type: text('type').notNull(),
  status: text('status').notNull(),
  veteranFilingState: veteranFilingStateEnum('veteran_filing_state'),
  assignedToUserId: uuid('assigned_to_user_id'),
  priority: text('priority').notNull().default('NORMAL'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  notes: text('notes'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// CASE STATE HISTORY
// ─────────────────────────────────────────

export const caseStateHistory = pgTable('case_state_history', {
  id: uuid('id').primaryKey(),
  caseId: uuid('case_id').notNull().references(() => cases.id),
  fromState: text('from_state'),
  toState: text('to_state').notNull(),
  actorId: uuid('actor_id'),
  actorType: actorTypeEnum('actor_type'),
  notes: text('notes'),
  correlationId: text('correlation_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id),
  caseId: uuid('case_id').references(() => cases.id),
  name: text('name').notNull(),
  type: text('type').notNull(),
  classification: dataClassificationEnum('classification').notNull().default('CONFIDENTIAL'),
  storageRef: text('storage_ref').notNull(),
  mimeType: text('mime_type'),
  uploadedByPersonId: uuid('uploaded_by_person_id').references(() => persons.id),
  approved: boolean('approved').notNull().default(false),
  approvedByUserId: uuid('approved_by_user_id'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// CONVERSATIONS / MESSAGES
// ─────────────────────────────────────────

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey(),
  customerId: uuid('customer_id').references(() => customers.id),
  personId: uuid('person_id').references(() => persons.id),
  channel: channelEnum('channel').notNull(),
  subject: text('subject'),
  status: text('status').notNull().default('OPEN'),
  assignedToUserId: uuid('assigned_to_user_id'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id),
  channel: channelEnum('channel').notNull(),
  direction: messageDirectionEnum('direction').notNull(),
  senderPersonId: uuid('sender_person_id').references(() => persons.id),
  senderLabel: text('sender_label'),
  body: text('body').notNull(),
  attachments: jsonb('attachments').notNull().default([]),
  providerMessageId: text('provider_message_id'),
  providerMetadata: jsonb('provider_metadata').notNull().default({}),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// INVOICES / PAYMENTS
// ─────────────────────────────────────────

export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  serviceOrderId: uuid('service_order_id'),
  stripeInvoiceId: text('stripe_invoice_id'),
  status: text('status').notNull().default('DRAFT'),
  amountDue: real('amount_due').notNull(),
  amountPaid: real('amount_paid').notNull().default(0),
  currency: text('currency').notNull().default('usd'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey(),
  invoiceId: uuid('invoice_id').references(() => invoices.id),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('usd'),
  status: text('status').notNull(),
  failureReason: text('failure_reason'),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// APPROVALS
// ─────────────────────────────────────────

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  level: approvalLevelEnum('level').notNull(),
  requestedByUserId: uuid('requested_by_user_id'),
  requestedByAgentId: text('requested_by_agent_id'),
  approvedByUserId: uuid('approved_by_user_id'),
  status: approvalStatusEnum('status').notNull().default('PENDING'),
  reason: text('reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  correlationId: text('correlation_id'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────

export const events = pgTable('events', {
  id: uuid('id').primaryKey(),
  eventType: text('event_type').notNull(),
  businessId: text('business_id').notNull().default('hutchrok-solutions-group'),
  source: text('source').notNull(),
  actor: text('actor').notNull(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  correlationId: text('correlation_id').notNull(),
  causationId: text('causation_id'),
  payload: jsonb('payload').notNull().default({}),
  metadata: jsonb('metadata').notNull().default({}),
  riskLevel: riskLevelEnum('risk_level').notNull().default('LOW'),
  schemaVersion: text('schema_version').notNull().default('1.0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey(),
  actor: text('actor').notNull(),
  actorType: actorTypeEnum('actor_type').notNull(),
  actionType: text('action_type').notNull(),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  result: auditResultEnum('result').notNull(),
  errorMessage: text('error_message'),
  correlationId: text('correlation_id'),
  causationId: text('causation_id'),
  source: text('source'),
  ipAddress: text('ip_address'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey(),
  severity: alertSeverityEnum('severity').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  entityType: text('entity_type'),
  entityId: uuid('entity_id'),
  acknowledged: boolean('acknowledged').notNull().default(false),
  acknowledgedByUserId: uuid('acknowledged_by_user_id'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// KNOWLEDGE
// ─────────────────────────────────────────

export const knowledgeItems = pgTable('knowledge_items', {
  id: uuid('id').primaryKey(),
  type: knowledgeTypeEnum('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  source: text('source'),
  sourceEvent: text('source_event'),
  confidence: real('confidence').notNull().default(1),
  effectiveAt: timestamp('effective_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  version: integer('version').notNull().default(1),
  supersedes: uuid('supersedes'),
  status: knowledgeStatusEnum('status').notNull().default('DRAFT'),
  approvedByUserId: uuid('approved_by_user_id'),
  division: text('division'),
  tags: jsonb('tags').notNull().default([]),
  embeddingRef: text('embedding_ref'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const learningCandidates = pgTable('learning_candidates', {
  id: uuid('id').primaryKey(),
  sourceEventId: text('source_event_id'),
  sourceType: text('source_type').notNull(),
  suggestedKnowledgeType: knowledgeTypeEnum('suggested_knowledge_type'),
  title: text('title').notNull(),
  content: text('content').notNull(),
  confidence: real('confidence').notNull(),
  contradicts: uuid('contradicts').references(() => knowledgeItems.id),
  status: text('status').notNull().default('PENDING'),
  reviewedByUserId: uuid('reviewed_by_user_id'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// AGENT RUNS
// ─────────────────────────────────────────

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  triggeredBy: text('triggered_by'),
  status: text('status').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  input: jsonb('input').notNull().default({}),
  output: jsonb('output'),
  error: text('error'),
  correlationId: text('correlation_id'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// DEPLOYMENTS
// ─────────────────────────────────────────

export const deployments = pgTable('deployments', {
  id: uuid('id').primaryKey(),
  environment: deploymentEnvironmentEnum('environment').notNull(),
  version: text('version').notNull(),
  gitRef: text('git_ref'),
  gitSha: text('git_sha'),
  status: deploymentStatusEnum('status').notNull().default('PENDING'),
  deployedByUserId: uuid('deployed_by_user_id'),
  approvalId: uuid('approval_id').references(() => approvals.id),
  url: text('url'),
  error: text('error'),
  deployedAt: timestamp('deployed_at', { withTimezone: true }),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// WEBSITE EVENTS
// ─────────────────────────────────────────

export const websiteEvents = pgTable('website_events', {
  id: uuid('id').primaryKey(),
  eventType: text('event_type').notNull(),
  sessionId: text('session_id'),
  personId: uuid('person_id').references(() => persons.id),
  page: text('page'),
  referrer: text('referrer'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  payload: jsonb('payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// CAMPAIGNS
// ─────────────────────────────────────────

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  channel: text('channel').notNull(),
  audienceId: text('audience_id'),
  status: text('status').notNull().default('DRAFT'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  budget: real('budget'),
  ownedByUserId: uuid('owned_by_user_id'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────
// GOVERNMENT OPPORTUNITIES
// ─────────────────────────────────────────

export const governmentOpportunities = pgTable('government_opportunities', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  solicitationNumber: text('solicitation_number'),
  agency: text('agency').notNull(),
  naicsCode: text('naics_code'),
  setAside: text('set_aside'),
  estimatedValue: real('estimated_value'),
  responseDeadline: timestamp('response_deadline', { withTimezone: true }),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  sourceUrl: text('source_url'),
  status: text('status').notNull().default('IDENTIFIED'),
  score: real('score'),
  notes: text('notes'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
