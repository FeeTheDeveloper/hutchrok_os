/**
 * Tests: Agent Definitions
 */

import { describe, it, expect } from 'vitest';
import { AGENT_DEFINITIONS, getAgentDefinition } from '../packages/agents/src/index.js';

describe('Agent Definitions', () => {
  it('has all 15 defined agents', () => {
    expect(AGENT_DEFINITIONS.length).toBe(15);
  });

  it('resolves agents by ID', () => {
    expect(getAgentDefinition('hutchrok-executive')).not.toBeNull();
    expect(getAgentDefinition('filing')).not.toBeNull();
    expect(getAgentDefinition('claude-engineering')).not.toBeNull();
    expect(getAgentDefinition('site-autopilot')).not.toBeNull();
    expect(getAgentDefinition('unknown-agent')).toBeNull();
  });

  it('filing agent cannot submit without approval', () => {
    const agent = getAgentDefinition('filing');
    expect(agent?.prohibitedActions).toContain('submit_filing');
    expect(agent?.approvalLevel).toBe('C');
    expect(agent?.permissions).toContain('prepare:filing');
    expect(agent?.accessibleTools).toContain('filing.prepare_portal_handoff');
  });

  it('claude engineering agent cannot deploy to production without approval', () => {
    const agent = getAgentDefinition('claude-engineering');
    expect(agent?.prohibitedActions).toContain('production_deploy_without_approval');
    expect(agent?.prohibitedActions).toContain('access_production_secrets');
  });

  it('finance agent cannot move money', () => {
    const agent = getAgentDefinition('finance');
    expect(agent?.prohibitedActions).toContain('move_money');
  });

  it('all agents have required fields', () => {
    for (const agent of AGENT_DEFINITIONS) {
      expect(agent.id).toBeTruthy();
      expect(agent.purpose).toBeTruthy();
      expect(agent.permissions.length).toBeGreaterThan(0);
      expect(agent.prohibitedActions.length).toBeGreaterThan(0);
      expect(agent.loggingRequirements.length).toBeGreaterThan(0);
      expect(agent.modelProfile).toBeTruthy();
    }
  });

  it('analytics agent has autonomous level', () => {
    const agent = getAgentDefinition('analytics');
    expect(agent?.autonomyLevel).toBe('AUTONOMOUS');
    expect(agent?.approvalLevel).toBe('A');
  });
});
