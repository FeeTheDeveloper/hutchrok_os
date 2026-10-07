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
  index,
  uniqueIndex,
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
  // Text, not uuid: approver identities come from AUTOPILOT_APPROVERS_JSON as
  // arbitrary configured strings, and a system-initiated withdrawal records
  // the agent id (e.g. 'site-autopilot') here. A uuid column rejects both.
  requestedByUserId: text('requested_by_user_id'),
  requestedByAgentId: text('requested_by_agent_id'),
  approvedByUserId: text('approved_by_user_id'),
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

// ─────────────────────────────────────────
// SITE AUTOPILOT — hutchrok.com signals + OS mailbox
// Backing tables for packages/autopilot (AutopilotStore).
// Message bodies are stored with RESTRICTED data redacted.
// ─────────────────────────────────────────

export const siteSignals = pgTable('site_signals', {
  id: uuid('id').primaryKey(),
  signalId: text('signal_id').notNull().unique(),
  signalType: text('signal_type').notNull(),
  source: text('source').notNull().default('hutchrok.com'),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  entityRef: text('entity_ref'),
  eventId: uuid('event_id'),
  correlationId: text('correlation_id'),
  payload: jsonb('payload').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emailThreads = pgTable('email_threads', {
  id: uuid('id').primaryKey(),
  ref: text('ref').notNull().unique(),
  contactEmail: text('contact_email').notNull(),
  contactName: text('contact_name'),
  subject: text('subject').notNull(),
  subjectKey: text('subject_key').notNull(),
  intent: text('intent').notNull(),
  sensitivity: dataClassificationEnum('sensitivity').notNull().default('INTERNAL'),
  status: text('status').notNull().default('awaiting_team'),
  source: text('source').notNull(),
  signalId: text('signal_id'),
  lastInboundAt: timestamp('last_inbound_at', { withTimezone: true }),
  lastOutboundAt: timestamp('last_outbound_at', { withTimezone: true }),
  followUpsSent: integer('follow_ups_sent').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emailMessages = pgTable('email_messages', {
  id: uuid('id').primaryKey(),
  threadId: uuid('thread_id').notNull().references(() => emailThreads.id),
  direction: messageDirectionEnum('direction').notNull(),
  kind: text('kind'),
  fromAddress: text('from_address').notNull(),
  toAddresses: jsonb('to_addresses').notNull().default([]),
  subject: text('subject').notNull(),
  textRedacted: text('text_redacted').notNull(),
  internetMessageId: text('internet_message_id').unique(),
  providerMessageId: text('provider_message_id'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emailDrafts = pgTable('email_drafts', {
  id: uuid('id').primaryKey(),
  threadId: uuid('thread_id').references(() => emailThreads.id),
  kind: text('kind').notNull(),
  toAddresses: jsonb('to_addresses').notNull().default([]),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  inReplyTo: text('in_reply_to'),
  references: jsonb('references').notNull().default([]),
  approvalId: uuid('approval_id').references(() => approvals.id),
  status: text('status').notNull(),
  generatedBy: text('generated_by').notNull(),
  providerMessageId: text('provider_message_id'),
  error: text('error'),
  correlationId: text('correlation_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const autopilotTasks = pgTable('autopilot_tasks', {
  id: uuid('id').primaryKey(),
  queue: text('queue').notNull(),
  title: text('title').notNull(),
  agentId: text('agent_id').notNull(),
  status: text('status').notNull().default('open'),
  threadId: uuid('thread_id').references(() => emailThreads.id),
  signalId: text('signal_id'),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  correlationId: text('correlation_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Per-contact mailbox state: consent (suppression) and ack cooldown. */
export const emailContacts = pgTable('email_contacts', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  suppressed: boolean('suppressed').notNull().default(false),
  suppressedReason: text('suppressed_reason'),
  lastAcknowledgedAt: timestamp('last_acknowledged_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});


// ═════════════════════════════════════════════════════════════════
// ACTIVITY KERNEL
//
// Section 12: idempotency and replay protection are enforced here, not only
// in application code. The unique indexes below are what actually make a
// retried webhook delivery incapable of producing a second action — without
// them, two concurrent deliveries can both read "not seen" and both act.
// ═════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// ACTIVITY KERNEL ENUMS
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
