/**
 * Playbooks — what the OS does for every action on hutchrok.com.
 *
 * Each site signal maps to an explicit, reviewable list of steps. The site
 * already sends its own client emails for case lifecycle events (submission
 * received, status changes), so those playbooks do NOT acknowledge again.
 */

import type { Intent } from './classifier.js';
import type { SiteSignal, SiteSignalType } from './signals.js';

export type AckTemplate = 'acknowledgment' | 'lead_welcome' | 'service_request';

export type PlaybookStep =
  | { kind: 'acknowledge'; template: AckTemplate }
  | { kind: 'notify_team'; title: string }
  | { kind: 'create_task'; queue: string; title: string; slaHours: number; agentId: string }
  | { kind: 'draft_reply' }
  | { kind: 'require_approval'; level: 'C' | 'D'; entityType: string; reason: string };

export interface IntentRoute {
  agentId: string;
  queue: string;
  slaHours: number;
}

/** Intent → owning agent (see packages/agents) and work queue. */
export const INTENT_ROUTES: Record<Intent, IntentRoute> = {
  filing: { agentId: 'intake', queue: 'filings', slaHours: 24 },
  case_status: { agentId: 'customer-service', queue: 'support', slaHours: 8 },
  membership: { agentId: 'sales', queue: 'sales', slaHours: 24 },
  billing: { agentId: 'finance', queue: 'billing', slaHours: 24 },
  veteran_claims: { agentId: 'compliance', queue: 'veteran-claims', slaHours: 24 },
  federal_contracting: { agentId: 'govcon', queue: 'govcon', slaHours: 48 },
  gov_housing: { agentId: 'govcon', queue: 'gov-housing', slaHours: 48 },
  marketing_services: { agentId: 'sales', queue: 'launch-services', slaHours: 24 },
  credit: { agentId: 'sales', queue: 'credit', slaHours: 48 },
  scheduling: { agentId: 'customer-service', queue: 'scheduling', slaHours: 8 },
  unsubscribe: { agentId: 'customer-service', queue: 'support', slaHours: 72 },
  spam: { agentId: 'customer-service', queue: 'triage', slaHours: 168 },
  general: { agentId: 'customer-service', queue: 'support', slaHours: 24 },
};

/** Case statuses that need an operator to act (filing submission is Level C). */
const OPERATOR_STATUSES: Record<string, PlaybookStep[]> = {
  READY_FOR_FILING: [
    { kind: 'create_task', queue: 'filings', title: 'Case ready for filing — prepare SOS submission', slaHours: 24, agentId: 'filing' },
    { kind: 'require_approval', level: 'C', entityType: 'filing_submission', reason: 'Filing submission requires Level C human approval.' },
  ],
  IN_REVIEW: [{ kind: 'create_task', queue: 'filings', title: 'Review completed intake', slaHours: 24, agentId: 'filing' }],
  VVL_PENDING: [{ kind: 'create_task', queue: 'filings', title: 'Follow up on Veteran Verification Letter', slaHours: 72, agentId: 'intake' }],
};

export function playbookFor(signal: SiteSignal, intent: Intent): PlaybookStep[] {
  const route = INTENT_ROUTES[intent];
  const byType: Record<SiteSignalType, () => PlaybookStep[]> = {
    'contact.submitted': () =>
      intent === 'spam'
        ? [{ kind: 'create_task', queue: 'triage', title: 'Possible spam contact message', slaHours: route.slaHours, agentId: route.agentId }]
        : [
            { kind: 'acknowledge', template: 'acknowledgment' },
            { kind: 'create_task', queue: route.queue, title: `Answer contact message (${intent})`, slaHours: route.slaHours, agentId: route.agentId },
            { kind: 'notify_team', title: 'New contact message from hutchrok.com' },
            { kind: 'draft_reply' },
          ],
    'lead.created': () => [
      { kind: 'acknowledge', template: 'lead_welcome' },
      { kind: 'create_task', queue: 'sales', title: 'New marketing lead — qualify and follow up', slaHours: 48, agentId: 'sales' },
    ],
    'intake.submitted': () => [
      { kind: 'notify_team', title: 'New filing intake submitted' },
      { kind: 'create_task', queue: 'filings', title: 'Review new filing intake', slaHours: 24, agentId: 'intake' },
    ],
    'service_request.submitted': () => [
      { kind: 'acknowledge', template: 'service_request' },
      { kind: 'create_task', queue: 'launch-services', title: 'Scope paid service request', slaHours: 24, agentId: 'sales' },
    ],
    'federal_intake.submitted': () => [
      { kind: 'acknowledge', template: 'acknowledgment' },
      { kind: 'create_task', queue: 'govcon', title: 'Review federal contracting readiness intake', slaHours: 48, agentId: 'govcon' },
    ],
    'case.created': () => [
      { kind: 'create_task', queue: 'filings', title: 'New filing case opened', slaHours: 24, agentId: 'filing' },
    ],
    'case.status_changed': () => OPERATOR_STATUSES[String(signal.data['new_status'] ?? '')] ?? [],
    'case.event': () => [],
    'document.uploaded': () => [
      { kind: 'create_task', queue: 'filings', title: 'Review uploaded document', slaHours: 24, agentId: 'filing' },
    ],
    'payment.completed': () => [
      { kind: 'notify_team', title: 'Payment completed on hutchrok.com' },
      { kind: 'create_task', queue: 'onboarding', title: 'Onboard paying client', slaHours: 24, agentId: 'customer-service' },
    ],
    'payment.failed': () => [
      { kind: 'notify_team', title: 'Payment failed on hutchrok.com' },
      { kind: 'create_task', queue: 'billing', title: 'Resolve failed payment', slaHours: 24, agentId: 'finance' },
    ],
    'membership.activated': () => [
      { kind: 'create_task', queue: 'onboarding', title: 'Welcome new member', slaHours: 24, agentId: 'customer-service' },
    ],
    'account.created': () => [],
    'site.other': () => [],
  };

  return byType[signal.type]();
}

/** Playbook for an inbound email to the OS mailbox. */
export function inboundEmailPlaybook(opts: { intent: Intent; automated: boolean; isNewThread: boolean }): PlaybookStep[] {
  if (opts.automated || opts.intent === 'spam') return [];
  if (opts.intent === 'unsubscribe') return [];

  const route = INTENT_ROUTES[opts.intent];
  const steps: PlaybookStep[] = [];
  if (opts.isNewThread) steps.push({ kind: 'acknowledge', template: 'acknowledgment' });
  steps.push(
    { kind: 'create_task', queue: route.queue, title: `Reply to inbound email (${opts.intent})`, slaHours: route.slaHours, agentId: route.agentId },
    { kind: 'notify_team', title: `Inbound email — ${opts.intent}` },
    { kind: 'draft_reply' },
  );
  return steps;
}
