/**
 * Hutchrok OS — MCP Tool Registry
 *
 * MCP tools are organized by namespace. All tools use strongly-typed Zod schemas.
 * Tools call domain services — never raw SQL or direct DB access.
 * High-risk tools enforce policy and approvals before execution.
 */

import { z } from 'zod';

// ─────────────────────────────────────────
// TOOL DEFINITION
// ─────────────────────────────────────────

export interface MCPToolDefinition<TInput extends z.ZodType = z.ZodType, TOutput = unknown> {
  name: string;
  namespace: string;
  description: string;
  inputSchema: TInput;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** Capability evaluated by the trusted MCP authorizer before the handler runs. */
  requiredCapability?: string;
  requiresApproval?: boolean;
  approvalLevel?: 'A' | 'B' | 'C' | 'D';
  handler: (input: z.infer<TInput>, context: MCPCallContext) => Promise<TOutput>;
}

// ─────────────────────────────────────────
// CALL CONTEXT
// ─────────────────────────────────────────

export interface MCPCallContext {
  callerIdentity: string;
  callerRole: string;
  callerType: 'USER' | 'AGENT' | 'SYSTEM';
  tenantId: string;
  correlationId: string;
  businessId: string;
  environment: 'local' | 'dev' | 'preview' | 'staging' | 'production';
}

export interface MCPAuthorizationRequest {
  fullName: string;
  input: unknown;
  context: MCPCallContext;
  requiredCapability?: string;
  riskLevel: MCPToolDefinition['riskLevel'];
  requiresApproval: boolean;
  approvalLevel?: NonNullable<MCPToolDefinition['approvalLevel']>;
}

export interface MCPAuthorizationDecision {
  allowed: boolean;
  reason: string;
}

/**
 * Implementations live at the authenticated application boundary. They must
 * resolve tenant/resource ownership and consume any required approval there;
 * request-body identity, tenant, capability, or approval claims are not proof.
 */
export interface MCPAuthorizer {
  authorize(request: MCPAuthorizationRequest): Promise<MCPAuthorizationDecision>;
}

export interface AgentAuthorizationProfile {
  id: string;
  role: string;
  permissions: readonly string[];
  accessibleTools: readonly string[];
}

export interface MCPResourceScope {
  tenantId: string;
  businessId: string;
  environment: MCPCallContext['environment'];
}

export interface AgentMCPAuthorizerConfig {
  resolveAgent(agentId: string): AgentAuthorizationProfile | null;
  /** Resolve ownership from trusted storage; never echo scope from the request. */
  resolveResourceScope(request: MCPAuthorizationRequest): Promise<MCPResourceScope | null>;
  /**
   * Atomically verify and consume the bound approval and persist a uniquely
   * keyed execution command. The command must remain retryable if the handler
   * or provider fails after this reservation succeeds.
   */
  reserveApprovedCommand?(request: MCPAuthorizationRequest): Promise<boolean>;
}

/**
 * Exact agent tool/capability enforcement with tenant and environment binding.
 * The application must create MCPCallContext from authenticated server state.
 */
export class AgentMCPAuthorizer implements MCPAuthorizer {
  constructor(private readonly config: AgentMCPAuthorizerConfig) {}

  async authorize(request: MCPAuthorizationRequest): Promise<MCPAuthorizationDecision> {
    const { context, fullName, requiredCapability } = request;
    if (context.callerType !== 'AGENT') {
      return { allowed: false, reason: 'Agent authorizer requires an authenticated agent principal.' };
    }

    const agent = this.config.resolveAgent(context.callerIdentity);
    if (!agent || agent.id !== context.callerIdentity || agent.role !== context.callerRole) {
      return { allowed: false, reason: 'Authenticated principal does not match a registered agent.' };
    }

    const toolAllowed = agent.accessibleTools.some((allowed) =>
      allowed === fullName || (allowed.endsWith('.*') && fullName.startsWith(allowed.slice(0, -1)))
    );
    if (!toolAllowed) {
      return { allowed: false, reason: `Agent ${agent.id} is not allowed to use ${fullName}.` };
    }

    if (requiredCapability && !agent.permissions.includes(requiredCapability)) {
      return { allowed: false, reason: `Agent ${agent.id} lacks capability ${requiredCapability}.` };
    }

    const scope = await this.config.resolveResourceScope(request);
    if (
      !scope ||
      scope.tenantId !== context.tenantId ||
      scope.businessId !== context.businessId ||
      scope.environment !== context.environment
    ) {
      return { allowed: false, reason: 'Resource scope does not match the authenticated tenant boundary.' };
    }

    if (request.requiresApproval) {
      if (!this.config.reserveApprovedCommand) {
        return { allowed: false, reason: 'No approval verifier is configured for this protected action.' };
      }
      if (!(await this.config.reserveApprovedCommand(request))) {
        return { allowed: false, reason: 'A current, request-bound approval was not reserved for execution.' };
      }
    }

    return { allowed: true, reason: 'Agent tool, capability, scope, and approval checks passed.' };
  }
}

// ─────────────────────────────────────────
// TOOL REGISTRY
// ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class MCPToolRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tools: Map<string, MCPToolDefinition<any, any>> = new Map();

  constructor(private readonly authorizer: MCPAuthorizer) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register<TInput extends z.ZodType, TOutput>(tool: MCPToolDefinition<TInput, TOutput>): void {
    const fullName = `${tool.namespace}.${tool.name}`;
    if (this.tools.has(fullName)) {
      throw new Error(
        `MCP tool registration collision: "${fullName}" is already registered. Each namespace.name must be unique.`
      );
    }
    this.tools.set(fullName, tool);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTool(fullName: string): MCPToolDefinition<any, any> | undefined {
    return this.tools.get(fullName);
  }

  listTools(): Array<{ fullName: string; description: string; namespace: string; name: string }> {
    return [...this.tools.values()].map((t) => ({
      fullName: `${t.namespace}.${t.name}`,
      name: t.name,
      description: t.description,
      namespace: t.namespace,
    }));
  }

  async call(
    fullName: string,
    input: unknown,
    context: MCPCallContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    const tool = this.getTool(fullName);
    if (!tool) throw new Error(`MCP tool not found: ${fullName}`);

    // Validate input
    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(`Invalid input for tool ${fullName}: ${parsed.error.message}`);
    }

    const decision = await this.authorizer.authorize({
      fullName,
      input: parsed.data,
      context,
      ...(tool.requiredCapability ? { requiredCapability: tool.requiredCapability } : {}),
      riskLevel: tool.riskLevel,
      requiresApproval: tool.requiresApproval ?? false,
      ...(tool.approvalLevel ? { approvalLevel: tool.approvalLevel } : {}),
    });
    if (!decision.allowed) {
      throw new Error(`Not authorized to call ${fullName}: ${decision.reason}`);
    }

    return tool.handler(parsed.data, context);
  }
}
