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
