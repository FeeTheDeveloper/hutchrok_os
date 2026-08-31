/**
 * Veteran Filing State Machine
 *
 * Enforces valid state transitions for veteran business formation cases.
 * Stores transition history.
 */

export const VETERAN_FILING_STATES = [
  'LEAD',
  'ELIGIBILITY_REVIEW',
  'ELIGIBLE',
  'VVL_VERIFICATION',
  'INTAKE_PENDING',
  'INTAKE_COMPLETE',
  'DOCUMENT_COLLECTION',
  'FILING_PREPARATION',
  'INTERNAL_REVIEW',
  'CUSTOMER_APPROVAL',
  'READY_TO_FILE',
  'SUBMITTED',
  'STATE_REVIEW',
  'APPROVED',
  'REJECTED',
  'CORRECTION_REQUIRED',
  'RESUBMITTED',
  'DOCUMENT_DELIVERY',
  'FORMATION_COMPLETE',
  'POST_FORMATION',
  'BUSINESS_LAUNCH',
  'CANCELLED',
] as const;

export type VeteranFilingState = (typeof VETERAN_FILING_STATES)[number];

/**
 * Valid forward transitions from each state.
 * An empty array means the state is terminal (no further transitions).
 */
export const VETERAN_FILING_TRANSITIONS: Record<VeteranFilingState, VeteranFilingState[]> = {
  LEAD: ['ELIGIBILITY_REVIEW', 'CANCELLED'],
  ELIGIBILITY_REVIEW: ['ELIGIBLE', 'CANCELLED'],
  ELIGIBLE: ['VVL_VERIFICATION', 'INTAKE_PENDING', 'CANCELLED'],
  VVL_VERIFICATION: ['INTAKE_PENDING', 'CANCELLED'],
  INTAKE_PENDING: ['INTAKE_COMPLETE', 'CANCELLED'],
  INTAKE_COMPLETE: ['DOCUMENT_COLLECTION', 'CANCELLED'],
  DOCUMENT_COLLECTION: ['FILING_PREPARATION', 'CANCELLED'],
  FILING_PREPARATION: ['INTERNAL_REVIEW', 'CANCELLED'],
  INTERNAL_REVIEW: ['CUSTOMER_APPROVAL', 'FILING_PREPARATION', 'CANCELLED'],
  CUSTOMER_APPROVAL: ['READY_TO_FILE', 'INTERNAL_REVIEW', 'CANCELLED'],
  READY_TO_FILE: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['STATE_REVIEW', 'REJECTED', 'CORRECTION_REQUIRED'],
  STATE_REVIEW: ['APPROVED', 'REJECTED', 'CORRECTION_REQUIRED'],
  APPROVED: ['DOCUMENT_DELIVERY'],
  REJECTED: ['CORRECTION_REQUIRED', 'CANCELLED'],
  CORRECTION_REQUIRED: ['RESUBMITTED', 'CANCELLED'],
  RESUBMITTED: ['STATE_REVIEW', 'APPROVED', 'REJECTED'],
  DOCUMENT_DELIVERY: ['FORMATION_COMPLETE'],
  FORMATION_COMPLETE: ['POST_FORMATION'],
  POST_FORMATION: ['BUSINESS_LAUNCH'],
  BUSINESS_LAUNCH: [],
  CANCELLED: [],
};

export interface StateTransitionResult {
  allowed: boolean;
  reason?: string;
}

export function canTransition(
  fromState: VeteranFilingState,
  toState: VeteranFilingState
): StateTransitionResult {
  const allowed = VETERAN_FILING_TRANSITIONS[fromState]?.includes(toState) ?? false;

  if (!allowed) {
    return {
      allowed: false,
      reason: `Cannot transition from ${fromState} to ${toState}. Allowed: [${(VETERAN_FILING_TRANSITIONS[fromState] ?? []).join(', ') || 'none (terminal state)'}]`,
    };
  }

  return { allowed: true };
}

export function isTerminalState(state: VeteranFilingState): boolean {
  const transitions = VETERAN_FILING_TRANSITIONS[state];
  return transitions !== undefined && transitions.length === 0;
}

export function getAllowedTransitions(state: VeteranFilingState): VeteranFilingState[] {
  return VETERAN_FILING_TRANSITIONS[state] ?? [];
}
