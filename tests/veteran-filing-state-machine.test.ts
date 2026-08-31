/**
 * Tests: Veteran Filing State Machine
 */

import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isTerminalState,
  getAllowedTransitions,
  VETERAN_FILING_STATES,
} from '../packages/domain/src/models/veteran-filing.js';

describe('Veteran Filing State Machine', () => {
  it('allows valid transitions', () => {
    expect(canTransition('LEAD', 'ELIGIBILITY_REVIEW').allowed).toBe(true);
    expect(canTransition('ELIGIBILITY_REVIEW', 'ELIGIBLE').allowed).toBe(true);
    expect(canTransition('READY_TO_FILE', 'SUBMITTED').allowed).toBe(true);
    expect(canTransition('APPROVED', 'DOCUMENT_DELIVERY').allowed).toBe(true);
    expect(canTransition('FORMATION_COMPLETE', 'POST_FORMATION').allowed).toBe(true);
  });

  it('rejects invalid transitions', () => {
    const result = canTransition('LEAD', 'READY_TO_FILE');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cannot transition');

    expect(canTransition('APPROVED', 'LEAD').allowed).toBe(false);
    expect(canTransition('BUSINESS_LAUNCH', 'LEAD').allowed).toBe(false);
  });

  it('identifies terminal states', () => {
    expect(isTerminalState('BUSINESS_LAUNCH')).toBe(true);
    expect(isTerminalState('CANCELLED')).toBe(true);
    expect(isTerminalState('LEAD')).toBe(false);
  });

  it('allows cancellation from most states', () => {
    const cancellableStates = ['LEAD', 'ELIGIBILITY_REVIEW', 'INTAKE_PENDING', 'DOCUMENT_COLLECTION'];
    for (const state of cancellableStates) {
      expect(canTransition(state as typeof VETERAN_FILING_STATES[number], 'CANCELLED').allowed).toBe(true);
    }
  });

  it('returns allowed transitions', () => {
    const transitions = getAllowedTransitions('SUBMITTED');
    expect(transitions).toContain('STATE_REVIEW');
    expect(transitions).toContain('REJECTED');
    expect(transitions).toContain('CORRECTION_REQUIRED');
  });
});
