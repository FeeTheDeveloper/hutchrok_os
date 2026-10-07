/**
 * Hutchrok OS — Activity Kernel Domain Models
 *
 * The typed boundary every inbound signal crosses before any agent acts:
 * provider receipts (idempotency/replay), assignments, exception queue,
 * schedules, SLAs, credential bindings, and the communication primitives
 * the existing Conversation/Message/Call models did not yet cover.
 *
 * All IDs are UUIDs generated at the application layer.
 * CredentialBinding holds secret *references* only — never secret material.
 */

import { z } from 'zod';
import { BaseEntitySchema, DataClassificationSchema, ChannelSchema } from './index.js';

// ─────────────────────────────────────────
// TENANT BINDING
//
// Section 12: "Deny execution when tenant/company/account binding is
// unresolved." Every activity-kernel entity carries this so an unresolved
// binding is a type error at the boundary, not a runtime surprise.
// ─────────────────────────────────────────

export const TenantBindingSchema = z.object({
  tenantId: z.string().min(1),
  companyId: z.string().min(1),
});
export type TenantBinding = z.infer<typeof TenantBindingSchema>;

// ─────────────────────────────────────────
// SERVICE LANES (Section 8)
// ─────────────────────────────────────────

export const ServiceLaneSchema = z.enum([
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
export type ServiceLane = z.infer<typeof ServiceLaneSchema>;

export const ApprovalLevelSchema = z.enum(['A', 'B', 'C', 'D']);

// ─────────────────────────────────────────
// PROVIDER EVENT RECEIPT
//
// Webhook idempotency and replay protection. One row per (provider,
// providerEventId). A retried delivery increments replayCount and is
// never allowed to produce a second action.
// ─────────────────────────────────────────

export const ProviderEventReceiptSchema = BaseEntitySchema.merge(TenantBindingSchema).extend({
  provider: z.string().min(1),
  providerEventId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  payloadHash: z.string().min(1),
  signatureVerified: z.boolean(),
  receivedAt: z.string().datetime(),
  firstSeenAt: z.string().datetime(),
  replayCount: z.number().int().min(0).default(0),
  activityEventId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type ProviderEventReceipt = z.infer<typeof ProviderEventReceiptSchema>;

// ─────────────────────────────────────────
// ASSIGNMENT (Section 6 contract)
//
// Exactly one accountable primary agent per assignment. Specialists attach
// as dependencies, never as co-owners.
// ─────────────────────────────────────────

export const AssignmentStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'AWAITING_APPROVAL',
  'BLOCKED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).default(3),
  backoffMs: z.number().int().min(0).default(30_000),
});
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

export const AssignmentSchema = BaseEntitySchema.merge(TenantBindingSchema).extend({
  objective: z.string().min(1),
  triggeringEventId: z.string().uuid(),
  /** The one accountable agent. */
  agentId: z.string().min(1),
  controller: z.string().min(1),
  lane: ServiceLaneSchema,
  inputs: z.record(z.unknown()).default({}),
  evidenceRefs: z.array(z.string()).default([]),
  allowedCapabilities: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  classification: DataClassificationSchema.default('INTERNAL'),
  credentialScope: z.array(z.string()).default([]),
  approvalLevel: ApprovalLevelSchema.default('A'),
  dependencies: z.array(z.string().uuid()).default([]),
  slaId: z.string().uuid().optional(),
  acceptanceCriteria: z.array(z.string()).default([]),
  evidenceRequired: z.array(z.string()).default([]),
  handoffTarget: z.string().optional(),
  retryPolicy: RetryPolicySchema.default({ maxAttempts: 3, backoffMs: 30_000 }),
  exceptionOwner: z.string().min(1),
  status: AssignmentStatusSchema.default('PENDING'),
  attempts: z.number().int().min(0).default(0),
  correlationId: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
});
export type Assignment = z.infer<typeof AssignmentSchema>;

// ─────────────────────────────────────────
// EXCEPTION QUEUE
//
// Section 12: "External completion requires provider evidence. Failure goes
// to exception queue." Nothing silently reports success.
// ─────────────────────────────────────────

export const ExceptionReasonSchema = z.enum([
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
export type ExceptionReason = z.infer<typeof ExceptionReasonSchema>;

export const ExceptionStatusSchema = z.enum([
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
  'DEAD_LETTER',
]);
export type ExceptionStatus = z.infer<typeof ExceptionStatusSchema>;

export const ExceptionQueueItemSchema = BaseEntitySchema.merge(TenantBindingSchema).extend({
  reason: ExceptionReasonSchema,
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  summary: z.string().min(1),
  detail: z.string().optional(),
  assignmentId: z.string().uuid().optional(),
  activityEventId: z.string().uuid().optional(),
  /** Role or user accountable for clearing this item. Never an AI agent. */
  ownerRole: z.string().min(1),
  status: ExceptionStatusSchema.default('OPEN'),
  evidenceRefs: z.array(z.string()).default([]),
  attempts: z.number().int().min(0).default(0),
  acknowledgedBy: z.string().optional(),
  acknowledgedAt: z.string().datetime().optional(),
  resolvedBy: z.string().optional(),
  resolvedAt: z.string().datetime().optional(),
  resolution: z.string().optional(),
  correlationId: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
});
export type ExceptionQueueItem = z.infer<typeof ExceptionQueueItemSchema>;

// ─────────────────────────────────────────
// SCHEDULED ACTION
//
// Follow-ups, deadlines, compliance reminders, marketing sends. Claimed
// under a lease so two workers cannot run the same action twice.
// ─────────────────────────────────────────

export const ScheduledActionStatusSchema = z.enum([
  'PENDING',
  'CLAIMED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
export type ScheduledActionStatus = z.infer<typeof ScheduledActionStatusSchema>;

export const ScheduledActionSchema = BaseEntitySchema.merge(TenantBindingSchema).extend({
  kind: z.string().min(1),
  dueAt: z.string().datetime(),
  payload: z.record(z.unknown()).default({}),
  status: ScheduledActionStatusSchema.default('PENDING'),
  /** Set while a worker holds the lease; cleared on release. */
  lockedUntil: z.string().datetime().optional(),
  lockedBy: z.string().optional(),
  attempts: z.number().int().min(0).default(0),
  maxAttempts: z.number().int().min(1).default(3),
  lastError: z.string().optional(),
  assignmentId: z.string().uuid().optional(),
  /** Collapses duplicate schedules for the same logical follow-up. */
  idempotencyKey: z.string().min(1),
  correlationId: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
});
export type ScheduledAction = z.infer<typeof ScheduledActionSchema>;

// ─────────────────────────────────────────
// SLA RECORD
// ─────────────────────────────────────────

export const SLAStatusSchema = z.enum(['ACTIVE', 'SATISFIED', 'BREACHED', 'CANCELLED']);
export type SLAStatus = z.infer<typeof SLAStatusSchema>;

export const SLARecordSchema = BaseEntitySchema.merge(TenantBindingSchema).extend({
  assignmentId: z.string().uuid(),
  lane: ServiceLaneSchema,
  startedAt: z.string().datetime(),
  dueAt: z.string().datetime(),
  satisfiedAt: z.string().datetime().optional(),
  breachedAt: z.string().datetime().optional(),
  status: SLAStatusSchema.default('ACTIVE'),
  metadata: z.record(z.unknown()).default({}),
});
export type SLARecord = z.infer<typeof SLARecordSchema>;

// ─────────────────────────────────────────
// CREDENTIAL BINDING
//
// Section 9: "stores provider/tenant/scopes/environment/secret-reference
// metadata only — never raw secrets."
//
// The refinement below is a real control, not documentation: a binding whose
// secretRef looks like secret material fails to parse.
// ─────────────────────────────────────────

/** Shapes that indicate secret material rather than a pointer to one. */
const SECRET_MATERIAL_PATTERNS: RegExp[] = [
  /^sk-/i,
  /^sk_(live|test)_/i,
  /^rk_(live|test)_/i,
  /^gh[pousr]_/,
  /^xox[abprs]-/,
  /^AKIA[0-9A-Z]{16}$/,
  /^AIza[0-9A-Za-z_-]{35}$/,
  /^re_[0-9A-Za-z]{20,}/,
  /^SG\./,
  /^(ey[A-Za-z0-9_-]+\.){2}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /^[A-Fa-f0-9]{64,}$/,
  /^[A-Za-z0-9+/]{60,}={0,2}$/,
];

export function looksLikeSecretMaterial(value: string): boolean {
  return SECRET_MATERIAL_PATTERNS.some((re) => re.test(value));
}

export const CredentialBindingSchema = BaseEntitySchema.merge(TenantBindingSchema).extend({
  provider: z.string().min(1),
  /** Pointer into the approved secret manager, e.g. "gcp-sm://hutchrok/resend#3". */
  secretRef: z
    .string()
    .min(1)
    .refine((v) => !looksLikeSecretMaterial(v), {
      message:
        'secretRef looks like secret material. Store a reference into the approved secret manager, never the secret itself.',
    }),
  scopes: z.array(z.string()).default([]),
  environment: z.enum(['local', 'dev', 'preview', 'staging', 'production']),
  /** The account/mailbox/channel this binding is allowed to touch. */
  accountRef: z.string().optional(),
  rotatedAt: z.string().datetime().optional(),
  revokedAt: z.string().datetime().optional(),
  classification: DataClassificationSchema.default('SECRET'),
  metadata: z.record(z.unknown()).default({}),
});
export type CredentialBinding = z.infer<typeof CredentialBindingSchema>;

// ─────────────────────────────────────────
// CONTACT POINT
// ─────────────────────────────────────────

export const ContactPointKindSchema = z.enum(['email', 'phone', 'social', 'postal']);
export type ContactPointKind = z.infer<typeof ContactPointKindSchema>;

export const ContactPointSchema = BaseEntitySchema.merge(TenantBindingSchema).extend({
  kind: ContactPointKindSchema,
  /** Normalized: lowercased email, E.164 phone. */
  value: z.string().min(1),
  personId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  verified: z.boolean().default(false),
  classification: DataClassificationSchema.default('INTERNAL'),
  metadata: z.record(z.unknown()).default({}),
});
export type ContactPoint = z.infer<typeof ContactPointSchema>;

// ─────────────────────────────────────────
// CONSENT RECORD
//
// Section 12: "Maintain phone/SMS consent/opt-out and email
// suppression/bounce state." UNKNOWN is distinct from REVOKED: we have not
// asked, versus they said no.
// ─────────────────────────────────────────

export const ConsentStateSchema = z.enum(['GRANTED', 'REVOKED', 'UNKNOWN']);
export type ConsentState = z.infer<typeof ConsentStateSchema>;

export const ConsentRecordSchema = BaseEntitySchema.merge(TenantBindingSchema).extend({
  contactPointId: z.string().uuid(),
  channel: ChannelSchema,
  state: ConsentStateSchema.default('UNKNOWN'),
  /** Why we believe we may contact them: 'web_form', 'existing_customer', ... */
  basis: z.string().optional(),
  capturedAt: z.string().datetime(),
  source: z.string().min(1),
  evidenceRef: z.string().optional(),
  revokedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

// ─────────────────────────────────────────
// ATTACHMENT EVIDENCE
//
// Attachments become evidence references only after classification and scan.
// ─────────────────────────────────────────

export const ScanStatusSchema = z.enum(['PENDING', 'CLEAN', 'INFECTED', 'FAILED']);
export type ScanStatus = z.infer<typeof ScanStatusSchema>;

export const AttachmentEvidenceSchema = BaseEntitySchema.merge(TenantBindingSchema).extend({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  bytes: z.number().int().min(0),
  /** Tenant-scoped storage pointer. Never an inline payload. */
  storageRef: z.string().min(1),
  sha256: z.string().min(1),
  classification: DataClassificationSchema.default('CONFIDENTIAL'),
  scanStatus: ScanStatusSchema.default('PENDING'),
  activityEventId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type AttachmentEvidence = z.infer<typeof AttachmentEvidenceSchema>;
