/**
 * Tests: MCP Tool Registry
 */

import { describe, it, expect } from 'vitest';
import { MCPToolRegistry, ALL_MCP_TOOLS, type MCPAuthorizer } from '../packages/mcp/src/index.js';

const mockContext = {
  callerIdentity: 'test-caller',
  callerRole: 'AI_AGENT',
  callerType: 'AGENT' as const,
  tenantId: 'tenant_test',
  correlationId: 'corr_test',
  businessId: 'hutchrok-solutions-group',
  environment: 'local' as const,
};

const allowTestAuthorizer: MCPAuthorizer = {
  authorize: async () => ({ allowed: true, reason: 'test authorizer' }),
};

function createRegistry(authorizer: MCPAuthorizer = allowTestAuthorizer): MCPToolRegistry {
  return new MCPToolRegistry(authorizer);
}

describe('MCP Tool Registry', () => {
  it('registers all tools without collision', () => {
    const registry = createRegistry();
    for (const tool of ALL_MCP_TOOLS) {
      registry.register(tool);
    }
    const tools = registry.listTools();
    expect(tools.length).toBe(ALL_MCP_TOOLS.length);
    // All fullNames must be unique
    const fullNames = tools.map((t) => t.fullName);
    expect(new Set(fullNames).size).toBe(fullNames.length);
  });

  it('throws on duplicate registration', () => {
    const registry = createRegistry();
    registry.register(ALL_MCP_TOOLS[0]!);
    expect(() => registry.register(ALL_MCP_TOOLS[0]!)).toThrow('registration collision');
  });

  it('resolves tools by full name', () => {
    const registry = createRegistry();
    for (const tool of ALL_MCP_TOOLS) {
      registry.register(tool);
    }
    const tool = registry.getTool('business.get_profile');
    expect(tool).toBeDefined();
    expect(tool?.namespace).toBe('business');
    expect(tool?.name).toBe('get_profile');
  });

  it('returns undefined for unknown tools', () => {
    const registry = createRegistry();
    expect(registry.getTool('unknown.tool')).toBeUndefined();
  });

  it('calls system.get_health successfully', async () => {
    const registry = createRegistry();
    for (const tool of ALL_MCP_TOOLS) {
      registry.register(tool);
    }
    const result = await registry.call('system.get_health', {}, mockContext);
    expect(result.status).toBe('healthy');
    expect(result.timestamp).toBeTruthy();
  });

  it('rejects invalid tool input', async () => {
    const registry = createRegistry();
    for (const tool of ALL_MCP_TOOLS) {
      registry.register(tool);
    }
    // customers.get requires a valid UUID
    await expect(registry.call('customers.get', { customerId: 'not-a-uuid' }, mockContext)).rejects.toThrow();
  });

  it('has expected high-risk tools with approval requirements', () => {
    const registry = createRegistry();
    for (const tool of ALL_MCP_TOOLS) {
      registry.register(tool);
    }

    const advanceFiling = registry.getTool('filing.advance');
    expect(advanceFiling?.riskLevel).toBe('HIGH');
    expect(advanceFiling?.requiresApproval).toBe(true);
    expect(advanceFiling?.approvalLevel).toBe('C');

    const productionDeploy = registry.getTool('development.request_production_deploy');
    expect(productionDeploy?.riskLevel).toBe('CRITICAL');
    expect(productionDeploy?.approvalLevel).toBe('C');
  });

  it('fails closed when the trusted authorizer denies the call', async () => {
    const registry = createRegistry({
      authorize: async () => ({ allowed: false, reason: 'tenant mismatch' }),
    });
    for (const tool of ALL_MCP_TOOLS) registry.register(tool);

    await expect(registry.call('system.get_health', {}, mockContext)).rejects.toThrow(
      'Not authorized to call system.get_health: tenant mismatch'
    );
  });

  it('builds a non-submitting Texas SOSPortal handoff manifest', async () => {
    const registry = createRegistry();
    for (const tool of ALL_MCP_TOOLS) registry.register(tool);

    const result = await registry.call('filing.prepare_portal_handoff', {
      caseId: '11111111-1111-4111-8111-111111111111',
      recordReference: 'sos-record-01',
      packetVersion: 'v1',
      packetDigest: 'a'.repeat(64),
      jurisdiction: 'TX',
      filingPurpose: 'manage_entity_record',
      entityType: 'limited_liability_company',
      officialInstructionsCheckedAt: '2026-10-05T21:00:00.000Z',
    }, mockContext);

    expect(result.status).toBe('HUMAN_OPERATOR_REQUIRED');
    expect(result.prohibitedAgentActions).toContain('submit_filing');
    expect(result.prohibitedAgentActions).toContain('make_payment');
  });

  it('rejects a portal URL where an opaque record reference is required', async () => {
    const registry = createRegistry();
    for (const tool of ALL_MCP_TOOLS) registry.register(tool);

    await expect(registry.call('filing.prepare_portal_handoff', {
      caseId: '11111111-1111-4111-8111-111111111111',
      recordReference: 'https://texas-sos.appiancloud.us/private-record',
      packetVersion: 'v1',
      packetDigest: 'a'.repeat(64),
      jurisdiction: 'TX',
      filingPurpose: 'manage_entity_record',
      entityType: 'limited_liability_company',
      officialInstructionsCheckedAt: '2026-10-05T21:00:00.000Z',
    }, mockContext)).rejects.toThrow('Invalid input');
  });
});
