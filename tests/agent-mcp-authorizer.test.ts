import { describe, expect, it, vi } from 'vitest';
import { getAgentDefinition } from '../packages/agents/src/index.js';
import {
  AgentMCPAuthorizer,
  ALL_MCP_TOOLS,
  MCPToolRegistry,
  type MCPCallContext,
  type MCPResourceScope,
} from '../packages/mcp/src/index.js';

const filingContext: MCPCallContext = {
  callerIdentity: 'filing',
  callerRole: 'AI_AGENT',
  callerType: 'AGENT',
  tenantId: 'tenant_hutchrok',
  businessId: 'hutchrok-solutions-group',
  correlationId: 'corr_filing_test',
  environment: 'local',
};

const matchingScope: MCPResourceScope = {
  tenantId: filingContext.tenantId,
  businessId: filingContext.businessId,
  environment: filingContext.environment,
};

function registryFor(options?: {
  scope?: MCPResourceScope | null;
  approval?: boolean;
}) {
  const reserveApprovedCommand = vi.fn(async () => options?.approval ?? false);
  const authorizer = new AgentMCPAuthorizer({
    resolveAgent: getAgentDefinition,
    resolveResourceScope: async () =>
      options?.scope === undefined ? matchingScope : options.scope,
    reserveApprovedCommand,
  });
  const registry = new MCPToolRegistry(authorizer);
  for (const tool of ALL_MCP_TOOLS) registry.register(tool);
  return { registry, reserveApprovedCommand };
}

const handoffInput = {
  caseId: '11111111-1111-4111-8111-111111111111',
  recordReference: 'sos-record-01',
  packetVersion: 'v1',
  packetDigest: 'a'.repeat(64),
  jurisdiction: 'TX',
  filingPurpose: 'manage_entity_record',
  entityType: 'limited_liability_company',
  officialInstructionsCheckedAt: '2026-10-05T21:00:00.000Z',
};

describe('AgentMCPAuthorizer', () => {
  it('allows the filing agent to prepare a tenant-bound human handoff', async () => {
    const { registry, reserveApprovedCommand } = registryFor();

    const result = await registry.call(
      'filing.prepare_portal_handoff',
      handoffInput,
      filingContext,
    );

    expect(result.status).toBe('HUMAN_OPERATOR_REQUIRED');
    expect(reserveApprovedCommand).not.toHaveBeenCalled();
  });

  it('denies a tool outside the registered agent allowlist', async () => {
    const { registry } = registryFor();

    await expect(
      registry.call(
        'payments.request_refund',
        {
          paymentId: '22222222-2222-4222-8222-222222222222',
          reason: 'test',
        },
        filingContext,
      ),
    ).rejects.toThrow('is not allowed to use payments.request_refund');
  });

  it('denies a cross-tenant resource before the handler runs', async () => {
    const { registry } = registryFor({
      scope: { ...matchingScope, tenantId: 'tenant_other' },
    });

    await expect(
      registry.call(
        'filing.prepare_portal_handoff',
        handoffInput,
        filingContext,
      ),
    ).rejects.toThrow('Resource scope does not match');
  });

  it('requires atomic approval verification for a protected filing transition', async () => {
    const denied = registryFor({ approval: false });
    await expect(
      denied.registry.call(
        'filing.advance',
        {
          caseId: handoffInput.caseId,
          toState: 'SUBMITTED',
        },
        filingContext,
      ),
    ).rejects.toThrow('request-bound approval was not reserved');

    const allowed = registryFor({ approval: true });
    await expect(
      allowed.registry.call(
        'filing.advance',
        {
          caseId: handoffInput.caseId,
          toState: 'INTERNAL_REVIEW',
        },
        filingContext,
      ),
    ).rejects.toThrow('filing.advance is not implemented');
    expect(allowed.reserveApprovedCommand).toHaveBeenCalledOnce();
  });
});
