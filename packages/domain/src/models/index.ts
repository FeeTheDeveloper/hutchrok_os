/**
 * Hutchrok OS — Core Domain Models
 *
 * Normalized domain entities for Hutchrok Solutions Group LLC.
 * All IDs are UUIDs. Designed for a person to own/interact with multiple organizations.
 * Customer is not modeled as a single case.
 */

import { z } from 'zod';

// ─────────────────────────────────────────
// BASE
// ─────────────────────────────────────────

export const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BaseEntity = z.infer<typeof BaseEntitySchema>;

// ─────────────────────────────────────────
// DATA CLASSIFICATION
// ─────────────────────────────────────────

export const DataClassificationSchema = z.enum([
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
  'SECRET',
]);
export type DataClassification = z.infer<typeof DataClassificationSchema>;

// ─────────────────────────────────────────
// PERSON
// ─────────────────────────────────────────

export const PersonSchema = BaseEntitySchema.extend({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  isVeteran: z.boolean().default(false),
  veteranVerified: z.boolean().default(false),
  classification: DataClassificationSchema.default('INTERNAL'),
  metadata: z.record(z.unknown()).default({}),
});
export type Person = z.infer<typeof PersonSchema>;

// ─────────────────────────────────────────
// ORGANIZATION
// ─────────────────────────────────────────

export const OrganizationSchema = BaseEntitySchema.extend({
  legalName: z.string(),
  tradeName: z.string().optional(),
  entityType: z.string().optional(),
  stateOfFormation: z.string().optional(),
  ein: z.string().optional(), // RESTRICTED — handle with care
  website: z.string().url().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  isActive: z.boolean().default(true),
  classification: DataClassificationSchema.default('INTERNAL'),
  metadata: z.record(z.unknown()).default({}),
});
export type Organization = z.infer<typeof OrganizationSchema>;

// ─────────────────────────────────────────
// ORGANIZATION MEMBER
// ─────────────────────────────────────────

export const OrganizationMemberSchema = BaseEntitySchema.extend({
  organizationId: z.string().uuid(),
  personId: z.string().uuid(),
  role: z.string(),
  title: z.string().optional(),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

// ─────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────

export const CustomerStatusSchema = z.enum([
  'LEAD',
  'PROSPECT',
  'ACTIVE',
  'INACTIVE',
  'CHURNED',
  'BLOCKED',
]);
export type CustomerStatus = z.infer<typeof CustomerStatusSchema>;

export const CustomerSchema = BaseEntitySchema.extend({
  personId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
  status: CustomerStatusSchema.default('LEAD'),
  customerClass: z.string(),
  ownedByUserId: z.string().uuid().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});
export type Customer = z.infer<typeof CustomerSchema>;

// ─────────────────────────────────────────
// LEAD
// ─────────────────────────────────────────

export const LeadSchema = BaseEntitySchema.extend({
  personId: z.string().uuid(),
  source: z.string(),
  campaign: z.string().optional(),
  capabilityInterest: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  qualified: z.boolean().default(false),
  convertedToCustomerId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Lead = z.infer<typeof LeadSchema>;

// ─────────────────────────────────────────
// OPPORTUNITY
// ─────────────────────────────────────────

export const OpportunitySchema = BaseEntitySchema.extend({
  customerId: z.string().uuid(),
  title: z.string(),
  capabilityId: z.string(),
  stage: z.string(),
  estimatedValue: z.number().optional(),
  probability: z.number().min(0).max(100).optional(),
  closeDate: z.string().datetime().optional(),
  ownedByUserId: z.string().uuid().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

// ─────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────

export const ServiceSchema = BaseEntitySchema.extend({
  capabilityId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  division: z.string(),
  isActive: z.boolean().default(true),
  basePrice: z.number().optional(),
  priceClassification: DataClassificationSchema.default('INTERNAL'),
  metadata: z.record(z.unknown()).default({}),
});
export type Service = z.infer<typeof ServiceSchema>;

// ─────────────────────────────────────────
// SERVICE ORDER
// ─────────────────────────────────────────

export const ServiceOrderSchema = BaseEntitySchema.extend({
  customerId: z.string().uuid(),
  serviceId: z.string().uuid(),
  status: z.string(),
  price: z.number().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type ServiceOrder = z.infer<typeof ServiceOrderSchema>;

// ─────────────────────────────────────────
// CASE (e.g. Veteran Filing Case)
// ─────────────────────────────────────────

export const CaseSchema = BaseEntitySchema.extend({
  customerId: z.string().uuid(),
  type: z.string(),
  status: z.string(),
  assignedToUserId: z.string().uuid().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  dueAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Case = z.infer<typeof CaseSchema>;

export const CaseRequirementSchema = BaseEntitySchema.extend({
  caseId: z.string().uuid(),
  description: z.string(),
  required: z.boolean().default(true),
  met: z.boolean().default(false),
  metAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type CaseRequirement = z.infer<typeof CaseRequirementSchema>;

export const CaseEventSchema = BaseEntitySchema.extend({
  caseId: z.string().uuid(),
  eventType: z.string(),
  fromStatus: z.string().optional(),
  toStatus: z.string().optional(),
  actorId: z.string().uuid().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type CaseEvent = z.infer<typeof CaseEventSchema>;

// ─────────────────────────────────────────
// MEMBERSHIP / SUBSCRIPTION
// ─────────────────────────────────────────

export const MembershipSchema = BaseEntitySchema.extend({
  customerId: z.string().uuid(),
  tier: z.string(),
  status: z.enum(['ACTIVE', 'CANCELLED', 'PAST_DUE', 'TRIALING']),
  startedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  renewsAt: z.string().datetime().optional(),
  stripeSubscriptionId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Membership = z.infer<typeof MembershipSchema>;

export const SubscriptionSchema = MembershipSchema; // alias
export type Subscription = Membership;

// ─────────────────────────────────────────
// INVOICE / PAYMENT
// ─────────────────────────────────────────

export const InvoiceSchema = BaseEntitySchema.extend({
  customerId: z.string().uuid(),
  serviceOrderId: z.string().uuid().optional(),
  stripeInvoiceId: z.string().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE']),
  amountDue: z.number(),
  amountPaid: z.number().default(0),
  currency: z.string().default('usd'),
  dueDate: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export const PaymentSchema = BaseEntitySchema.extend({
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  stripePaymentIntentId: z.string().optional(),
  amount: z.number(),
  currency: z.string().default('usd'),
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']),
  failureReason: z.string().optional(),
  refundedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Payment = z.infer<typeof PaymentSchema>;

// ─────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────

export const DocumentSchema = BaseEntitySchema.extend({
  customerId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  name: z.string(),
  type: z.string(),
  classification: DataClassificationSchema.default('CONFIDENTIAL'),
  storageRef: z.string(),
  mimeType: z.string().optional(),
  uploadedByPersonId: z.string().uuid().optional(),
  approved: z.boolean().default(false),
  approvedByUserId: z.string().uuid().optional(),
  approvedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Document = z.infer<typeof DocumentSchema>;

export const DocumentVersionSchema = BaseEntitySchema.extend({
  documentId: z.string().uuid(),
  version: z.number().int().positive(),
  storageRef: z.string(),
  uploadedByPersonId: z.string().uuid().optional(),
  notes: z.string().optional(),
});
export type DocumentVersion = z.infer<typeof DocumentVersionSchema>;

// ─────────────────────────────────────────
// CONVERSATION / MESSAGE / CALL
// ─────────────────────────────────────────

export const ChannelSchema = z.enum([
  'email',
  'sms',
  'voice',
  'voicemail',
  'website_chat',
  'social',
  'internal',
]);
export type Channel = z.infer<typeof ChannelSchema>;

export const ConversationSchema = BaseEntitySchema.extend({
  customerId: z.string().uuid().optional(),
  personId: z.string().uuid().optional(),
  channel: ChannelSchema,
  subject: z.string().optional(),
  status: z.enum(['OPEN', 'RESOLVED', 'WAITING_ON_CUSTOMER', 'WAITING_ON_HUTCHROK']),
  assignedToUserId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const MessageSchema = BaseEntitySchema.extend({
  conversationId: z.string().uuid(),
  channel: ChannelSchema,
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  senderPersonId: z.string().uuid().optional(),
  senderLabel: z.string().optional(),
  body: z.string(),
  attachments: z.array(z.string()).default([]),
  providerMessageId: z.string().optional(),
  providerMetadata: z.record(z.unknown()).default({}),
  sentAt: z.string().datetime().optional(),
  deliveredAt: z.string().datetime().optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const CallSchema = BaseEntitySchema.extend({
  conversationId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  fromNumber: z.string(),
  toNumber: z.string(),
  status: z.enum(['INITIATED', 'RINGING', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'FAILED', 'VOICEMAIL']),
  duration: z.number().optional(),
  transcriptionRef: z.string().optional(),
  recordingRef: z.string().optional(),
  providerCallId: z.string().optional(),
  answeredAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Call = z.infer<typeof CallSchema>;

// ─────────────────────────────────────────
// TASK / DEADLINE
// ─────────────────────────────────────────

export const TaskSchema = BaseEntitySchema.extend({
  title: z.string(),
  description: z.string().optional(),
  assignedToUserId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']).default('TODO'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  dueAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Task = z.infer<typeof TaskSchema>;

export const DeadlineSchema = BaseEntitySchema.extend({
  entityType: z.string(),
  entityId: z.string().uuid(),
  label: z.string(),
  dueAt: z.string().datetime(),
  critical: z.boolean().default(false),
  met: z.boolean().default(false),
  metadata: z.record(z.unknown()).default({}),
});
export type Deadline = z.infer<typeof DeadlineSchema>;

// ─────────────────────────────────────────
// APPROVAL
// ─────────────────────────────────────────

export const ApprovalSchema = BaseEntitySchema.extend({
  entityType: z.string(),
  entityId: z.string().uuid(),
  level: z.enum(['A', 'B', 'C', 'D']),
  requestedByUserId: z.string().uuid().optional(),
  requestedByAgentId: z.string().optional(),
  approvedByUserId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'AUTO_APPROVED']),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
  correlationId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Approval = z.infer<typeof ApprovalSchema>;

// ─────────────────────────────────────────
// GOVERNMENT CONTRACTING
// ─────────────────────────────────────────

export const GovernmentOpportunitySchema = BaseEntitySchema.extend({
  title: z.string(),
  solicitationNumber: z.string().optional(),
  agency: z.string(),
  naicsCode: z.string().optional(),
  setAside: z.string().optional(),
  estimatedValue: z.number().optional(),
  responseDeadline: z.string().datetime().optional(),
  postedAt: z.string().datetime().optional(),
  sourceUrl: z.string().url().optional(),
  status: z.enum(['IDENTIFIED', 'QUALIFYING', 'PURSUING', 'SUBMITTED', 'AWARDED', 'NOT_PURSUING', 'LOST']),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type GovernmentOpportunity = z.infer<typeof GovernmentOpportunitySchema>;

export const ProposalSchema = BaseEntitySchema.extend({
  opportunityId: z.string().uuid(),
  title: z.string(),
  status: z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'SUBMITTED', 'AWARDED', 'NOT_AWARDED']),
  submittedAt: z.string().datetime().optional(),
  value: z.number().optional(),
  assignedToUserId: z.string().uuid().optional(),
  documentRef: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Proposal = z.infer<typeof ProposalSchema>;

export const ContractSchema = BaseEntitySchema.extend({
  opportunityId: z.string().uuid().optional(),
  proposalId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  title: z.string(),
  contractNumber: z.string().optional(),
  value: z.number().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'TERMINATED']),
  documentRef: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Contract = z.infer<typeof ContractSchema>;

export const SubcontractorSchema = BaseEntitySchema.extend({
  organizationId: z.string().uuid(),
  contractId: z.string().uuid().optional(),
  role: z.string().optional(),
  value: z.number().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  metadata: z.record(z.unknown()).default({}),
});
export type Subcontractor = z.infer<typeof SubcontractorSchema>;

// ─────────────────────────────────────────
// MARKETING
// ─────────────────────────────────────────

export const CampaignSchema = BaseEntitySchema.extend({
  name: z.string(),
  type: z.string(),
  channel: z.string(),
  audienceId: z.string().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  budget: z.number().optional(),
  ownedByUserId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Campaign = z.infer<typeof CampaignSchema>;

export const ContentAssetSchema = BaseEntitySchema.extend({
  campaignId: z.string().uuid().optional(),
  name: z.string(),
  type: z.enum(['image', 'video', 'copy', 'email', 'social_post', 'ad']),
  status: z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']),
  storageRef: z.string().optional(),
  body: z.string().optional(),
  approvedByUserId: z.string().uuid().optional(),
  approvedAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type ContentAsset = z.infer<typeof ContentAssetSchema>;

export const SocialAccountSchema = BaseEntitySchema.extend({
  platform: z.string(),
  handle: z.string().optional(),
  url: z.string().url().optional(),
  providerId: z.string().optional(),
  verified: z.boolean().default(false),
  lastSyncAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type SocialAccount = z.infer<typeof SocialAccountSchema>;

// ─────────────────────────────────────────
// WEBSITE / ANALYTICS EVENTS
// ─────────────────────────────────────────

export const WebsiteEventSchema = BaseEntitySchema.extend({
  eventType: z.string(),
  sessionId: z.string().optional(),
  personId: z.string().uuid().optional(),
  page: z.string().optional(),
  referrer: z.string().optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
});
export type WebsiteEvent = z.infer<typeof WebsiteEventSchema>;

export const AnalyticsEventSchema = BaseEntitySchema.extend({
  source: z.string(),
  eventType: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  value: z.number().optional(),
  dimensions: z.record(z.unknown()).default({}),
});
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

// ─────────────────────────────────────────
// KNOWLEDGE
// ─────────────────────────────────────────

export const KnowledgeTypeSchema = z.enum([
  'POLICY',
  'SOP',
  'BUSINESS_FACT',
  'SERVICE',
  'PRICING',
  'CUSTOMER_PATTERN',
  'MARKETING_INSIGHT',
  'GOVCON_INTELLIGENCE',
  'TECHNICAL',
  'LEGAL_BOUNDARY',
  'OWNER_DECISION',
  'BRAND_RULE',
]);
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>;

export const KnowledgeItemSchema = BaseEntitySchema.extend({
  type: KnowledgeTypeSchema,
  title: z.string(),
  content: z.string(),
  source: z.string().optional(),
  sourceEvent: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1),
  effectiveAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  version: z.number().int().positive().default(1),
  supersedes: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED']).default('DRAFT'),
  approvedByUserId: z.string().uuid().optional(),
  division: z.string().optional(),
  tags: z.array(z.string()).default([]),
  embeddingRef: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;

export const LearningCandidateSchema = BaseEntitySchema.extend({
  sourceEventId: z.string().optional(),
  sourceType: z.string(),
  suggestedKnowledgeType: KnowledgeTypeSchema.optional(),
  title: z.string(),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  contradicts: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED']).default('PENDING'),
  reviewedByUserId: z.string().uuid().optional(),
  reviewedAt: z.string().datetime().optional(),
  rejectionReason: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type LearningCandidate = z.infer<typeof LearningCandidateSchema>;

// ─────────────────────────────────────────
// AGENT
// ─────────────────────────────────────────

export const AgentRunSchema = BaseEntitySchema.extend({
  agentId: z.string(),
  triggeredBy: z.string().optional(),
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  input: z.record(z.unknown()).default({}),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  correlationId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const AgentActionSchema = BaseEntitySchema.extend({
  agentRunId: z.string().uuid(),
  agentId: z.string(),
  actionType: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED']),
  approvalLevel: z.enum(['A', 'B', 'C', 'D']).optional(),
  approvalId: z.string().uuid().optional(),
  input: z.record(z.unknown()).default({}),
  output: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  executedAt: z.string().datetime().optional(),
  correlationId: z.string().optional(),
});
export type AgentAction = z.infer<typeof AgentActionSchema>;

export const ToolCallSchema = BaseEntitySchema.extend({
  agentRunId: z.string().uuid(),
  toolName: z.string(),
  namespace: z.string().optional(),
  input: z.record(z.unknown()).default({}),
  output: z.record(z.unknown()).optional(),
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED']),
  durationMs: z.number().optional(),
  error: z.string().optional(),
  correlationId: z.string().optional(),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

// ─────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────

export const AuditLogSchema = BaseEntitySchema.extend({
  actor: z.string(),
  actorType: z.enum(['USER', 'AGENT', 'SYSTEM', 'CONNECTOR']),
  actionType: z.string(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  before: z.record(z.unknown()).optional(),
  after: z.record(z.unknown()).optional(),
  result: z.enum(['SUCCESS', 'FAILURE', 'PARTIAL']),
  errorMessage: z.string().optional(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  source: z.string().optional(),
  ipAddress: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

// ─────────────────────────────────────────
// ALERT
// ─────────────────────────────────────────

export const AlertSchema = BaseEntitySchema.extend({
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']),
  type: z.string(),
  title: z.string(),
  body: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  acknowledged: z.boolean().default(false),
  acknowledgedByUserId: z.string().uuid().optional(),
  acknowledgedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Alert = z.infer<typeof AlertSchema>;

// ─────────────────────────────────────────
// DEPLOYMENT
// ─────────────────────────────────────────

export const DeploymentSchema = BaseEntitySchema.extend({
  environment: z.enum(['local', 'dev', 'preview', 'staging', 'production']),
  version: z.string(),
  gitRef: z.string().optional(),
  gitSha: z.string().optional(),
  status: z.enum([
    'PENDING',
    'BUILDING',
    'PREVIEW_READY',
    'APPROVED',
    'DEPLOYING',
    'DEPLOYED',
    'FAILED',
    'ROLLED_BACK',
  ]),
  deployedByUserId: z.string().uuid().optional(),
  approvalId: z.string().uuid().optional(),
  url: z.string().url().optional(),
  error: z.string().optional(),
  deployedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type Deployment = z.infer<typeof DeploymentSchema>;
