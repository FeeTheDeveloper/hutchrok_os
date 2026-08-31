/**
 * Tests: MCP Tool Registry
 */

import { describe, it, expect } from 'vitest';
import { MCPToolRegistry, ALL_MCP_TOOLS } from '../packages/mcp/src/index.js';

const mockContext = {
  callerIdentity: 'test-caller',
  callerRole: 'AI_AGENT',
  correlationId: 'corr_test',
  businessId: 'hutchrok-solutions-group',
};

describe('MCP Tool Registry', () => {
  it('registers all tools without collision', () => {
    const registry = new MCPToolRegistry();
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
    const registry = new MCPToolRegistry();
    registry.register(ALL_MCP_TOOLS[0]!);
    expect(() => registry.register(ALL_MCP_TOOLS[0]!)).toThrow('registration collision');
  });

  it('resolves tools by full name', () => {
    const registry = new MCPToolRegistry();
    for (const tool of ALL_MCP_TOOLS) {
      registry.register(tool);
    }
    const tool = registry.getTool('business.get_profile');
    expect(tool).toBeDefined();
    expect(tool?.namespace).toBe('business');
    expect(tool?.name).toBe('get_profile');
  });

  it('returns undefined for unknown tools', () => {
    const registry = new MCPToolRegistry();
    expect(registry.getTool('unknown.tool')).toBeUndefined();
  });

  it('calls system.get_health successfully', async () => {
    const registry = new MCPToolRegistry();
    for (const tool of ALL_MCP_TOOLS) {
      registry.register(tool);
    }
    const result = await registry.call('system.get_health', {}, mockContext);
    expect(result.status).toBe('healthy');
    expect(result.timestamp).toBeTruthy();
  });

  it('rejects invalid tool input', async () => {
    const registry = new MCPToolRegistry();
    for (const tool of ALL_MCP_TOOLS) {
      registry.register(tool);
    }
    // customers.get requires a valid UUID
    await expect(registry.call('customers.get', { customerId: 'not-a-uuid' }, mockContext)).rejects.toThrow();
  });

  it('has expected high-risk tools with approval requirements', () => {
    const registry = new MCPToolRegistry();
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
});
