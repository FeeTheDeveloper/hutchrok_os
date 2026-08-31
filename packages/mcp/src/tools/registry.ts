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
  correlationId: string;
  businessId: string;
}

// ─────────────────────────────────────────
// TOOL REGISTRY
// ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class MCPToolRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tools: Map<string, MCPToolDefinition<any, any>> = new Map();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register<TInput extends z.ZodType, TOutput>(tool: MCPToolDefinition<TInput, TOutput>): void {
    const fullName = `${tool.namespace}.${tool.name}`;
    this.tools.set(fullName, tool);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTool(fullName: string): MCPToolDefinition<any, any> | undefined {
    return this.tools.get(fullName);
  }

  listTools(): Array<{ name: string; description: string; namespace: string }> {
    return [...this.tools.values()].map((t) => ({
      name: `${t.namespace}.${t.name}`,
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

    return tool.handler(parsed.data, context);
  }
}
