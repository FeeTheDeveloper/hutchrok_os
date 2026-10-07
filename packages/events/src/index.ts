/**
 * Hutchrok OS — Event Envelope
 *
 * Every significant event flows through this normalized envelope.
 * All events must be durable enough to support replay and investigation.
 */

import { z } from 'zod';

// ─────────────────────────────────────────
// RISK LEVEL
// ─────────────────────────────────────────

export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

// ─────────────────────────────────────────
// EVENT ENVELOPE
// ─────────────────────────────────────────

export const EventEnvelopeSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.string(),
  business_id: z.string().default('hutchrok-solutions-group'),
  source: z.string(),
  actor: z.string(),
  entity_type: z.string().optional(),
  entity_id: z.string().optional(),
  timestamp: z.string().datetime(),
  correlation_id: z.string(),
  causation_id: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
  risk_level: RiskLevelSchema.default('LOW'),
  schema_version: z.string().default('1.0'),
});

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

// ─────────────────────────────────────────
// ACTIVITY ENVELOPE
//
// Section 4 NORMALIZE: the common boundary across site, email, phone,
// social, filing and scheduled work.
//
// This extends EventEnvelope rather than replacing it — every existing
// producer and consumer keeps working, and an ActivityEnvelope is always a
// valid EventEnvelope. The added fields are the ones the activity kernel
// cannot route or authorize without:
//
//   tenant_id / company_id  — portfolio isolation (Section 12: deny when
//                             the binding is unresolved)
//   channel                 — which surface this arrived on
//   data_classification     — gates model exposure (RESTRICTED/SECRET never)
//   evidence_ref            — pointer to provider proof, never inline payload
//   provider / provider_event_id — ties the activity back to its receipt
// ─────────────────────────────────────────

export const ActivityChannelSchema = z.enum([
  'email',
  'sms',
  'voice',
  'voicemail',
  'website',
  'website_chat',
  'social',
  'portal',
  'scheduled',
  'internal',
]);
export type ActivityChannel = z.infer<typeof ActivityChannelSchema>;

export const ActivityDataClassificationSchema = z.enum([
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
  'SECRET',
]);
export type ActivityDataClassification = z.infer<typeof ActivityDataClassificationSchema>;

export const ActivityEnvelopeSchema = EventEnvelopeSchema.extend({
  tenant_id: z.string().min(1),
  company_id: z.string().min(1),
  channel: ActivityChannelSchema,
  data_classification: ActivityDataClassificationSchema.default('INTERNAL'),
  /** Pointer to provider evidence (receipt id, storage ref). Never the payload itself. */
  evidence_ref: z.string().optional(),
  provider: z.string().optional(),
  provider_event_id: z.string().optional(),
});

export type ActivityEnvelope = z.infer<typeof ActivityEnvelopeSchema>;

/** True when this envelope carries the activity-kernel fields. */
export function isActivityEnvelope(e: EventEnvelope): e is ActivityEnvelope {
  return ActivityEnvelopeSchema.safeParse(e).success;
}

/**
 * Classifications that must never reach a model. Enforced by the policy
 * engine; exposed here so the boundary can refuse before a call is built.
 */
export const MODEL_FORBIDDEN_CLASSIFICATIONS: readonly ActivityDataClassification[] = [
  'RESTRICTED',
  'SECRET',
];

export function isModelPermitted(c: ActivityDataClassification): boolean {
  return !MODEL_FORBIDDEN_CLASSIFICATIONS.includes(c);
}

// ─────────────────────────────────────────
// EVENT TAXONOMY
// ─────────────────────────────────────────

export const EVENT_TYPES = [
  // Customer
  'customer.created',
  'customer.updated',

  // Lead
  'lead.created',
  'lead.qualified',
  'lead.pricing_viewed',
  'lead.checkout_abandoned',

  // Intake
  'intake.started',
  'intake.completed',
  'intake.abandoned',

  // Document
  'document.uploaded',
  'document.approved',
  'document.rejected',
  'document.vvl.received',

  // Filing
  'filing.created',
  'filing.ready_for_review',
  'filing.approved_for_submission',
  'filing.submitted',
  'filing.approved',
  'filing.rejected',
  'filing.correction_required',

  // Payment
  'payment.started',
  'payment.completed',
  'payment.failed',
  'payment.refund_requested',

  // Message / Call
  'message.received',
  'message.sent',
  'call.received',
  'call.missed',
  'call.completed',
  'voicemail.received',

  // Email (OS mailbox)
  'email.received',
  'email.sent',
  'email.reply_drafted',
  'email.reply_approved',
  'email.reply_rejected',
  'email.suppressed',

  // Site (hutchrok.com signals)
  'site.contact.submitted',
  'site.service_request.submitted',
  'site.federal_intake.submitted',
  'site.case.status_changed',
  'site.case.event',
  'site.membership.activated',
  'site.account.created',

  // Autopilot beat
  'autopilot.beat.tick',
  'autopilot.task.escalated',

  // Activity kernel — ingestion boundary
  'activity.received',
  'activity.normalized',
  'activity.duplicate_suppressed',
  'webhook.received',
  'webhook.replay_rejected',
  'webhook.signature_invalid',

  // Activity kernel — assignment
  'assignment.created',
  'assignment.started',
  'assignment.blocked',
  'assignment.completed',
  'assignment.failed',

  // Activity kernel — exception queue
  'exception.raised',
  'exception.acknowledged',
  'exception.resolved',
  'exception.dead_lettered',

  // Activity kernel — schedules
  'schedule.created',
  'schedule.claimed',
  'schedule.executed',
  'schedule.failed',
  'schedule.cancelled',

  // Activity kernel — SLA
  'sla.satisfied',
  'sla.breached',

  // Consent
  'consent.granted',
  'consent.revoked',

  // Appointment
  'appointment.created',
  'appointment.cancelled',

  // Campaign
  'campaign.created',
  'campaign.launched',
  'campaign.performance_declining',

  // Knowledge
  'knowledge.learning_candidate_created',
  'knowledge.approved',
  'knowledge.rejected',

  // Agent
  'agent.action.requested',
  'agent.action.completed',
  'agent.action.failed',

  // Deployment
  'deployment.created',
  'deployment.preview_ready',
  'deployment.failed',
  'deployment.production_requested',
  'deployment.completed',
  'deployment.rolled_back',
] as const;

export type EventType = (typeof EVENT_TYPES)[number] | (string & Record<never, never>);

// ─────────────────────────────────────────
// EVENT FACTORY
// ─────────────────────────────────────────

import { generateId, generateCorrelationId, nowISO } from '@hutchrok-os/shared';

export interface CreateEventOptions {
  event_type: EventType;
  source: string;
  actor: string;
  entity_type?: string;
  entity_id?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  risk_level?: RiskLevel;
  correlation_id?: string;
  causation_id?: string;
}

export function createEvent(opts: CreateEventOptions): EventEnvelope {
  return EventEnvelopeSchema.parse({
    event_id: generateId(),
    event_type: opts.event_type,
    business_id: 'hutchrok-solutions-group',
    source: opts.source,
    actor: opts.actor,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id,
    timestamp: nowISO(),
    correlation_id: opts.correlation_id ?? generateCorrelationId(),
    causation_id: opts.causation_id,
    payload: opts.payload ?? {},
    metadata: opts.metadata ?? {},
    risk_level: opts.risk_level ?? 'LOW',
    schema_version: '1.0',
  });
}

// ─────────────────────────────────────────
// ACTIVITY FACTORY
// ─────────────────────────────────────────

export interface CreateActivityOptions extends CreateEventOptions {
  tenant_id: string;
  company_id: string;
  channel: ActivityChannel;
  data_classification?: ActivityDataClassification;
  evidence_ref?: string;
  provider?: string;
  provider_event_id?: string;
}

/**
 * Builds a normalized ActivityEnvelope. Throws if the tenant/company
 * binding is missing — Section 12 requires denial, not a default.
 */
export function createActivity(opts: CreateActivityOptions): ActivityEnvelope {
  if (!opts.tenant_id || !opts.company_id) {
    throw new Error(
      'Cannot normalize an activity without a resolved tenant/company binding.'
    );
  }

  return ActivityEnvelopeSchema.parse({
    ...createEvent(opts),
    tenant_id: opts.tenant_id,
    company_id: opts.company_id,
    channel: opts.channel,
    data_classification: opts.data_classification ?? 'INTERNAL',
    evidence_ref: opts.evidence_ref,
    provider: opts.provider,
    provider_event_id: opts.provider_event_id,
  });
}

// ─────────────────────────────────────────
// EVENT HANDLER TYPE
// ─────────────────────────────────────────

export type EventHandler = (event: EventEnvelope) => Promise<void>;

export interface EventSubscription {
  event_type: EventType | '*';
  handler: EventHandler;
}

// ─────────────────────────────────────────
// PROCESSING PIPELINE STAGES
// ─────────────────────────────────────────

export type EventProcessingStage =
  | 'VALIDATION'
  | 'PERSIST'
  | 'POLICY_EVALUATION'
  | 'WORKFLOW_MATCH'
  | 'ACTION'
  | 'AUDIT'
  | 'ANALYTICS'
  | 'LEARNING';

export interface EventProcessingResult {
  event_id: string;
  stage: EventProcessingStage;
  success: boolean;
  error?: string;
  durationMs?: number;
}
