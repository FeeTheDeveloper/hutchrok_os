/**
 * Hutchrok OS — Agent Runtime
 *
 * Executes agents, enforces policies, requires approvals, and emits audit records.
 */

import { generateId, nowISO } from '@hutchrok-os/shared';
import type { AgentRun, AgentAction } from '@hutchrok-os/domain';
import { evaluateActionPolicy } from '@hutchrok-os/policies';
import type { AuditService } from '@hutchrok-os/audit';
import type { ApprovalService } from '@hutchrok-os/approvals';
import type { AgentDefinition } from '../definitions/types.js';
import { getAgentDefinition } from '../definitions/agents.js';

export interface AgentRunStore {
  create(run: AgentRun): Promise<void>;
  update(id: string, updates: Partial<AgentRun>): Promise<void>;
  findById(id: string): Promise<AgentRun | null>;
}

export interface AgentActionStore {
  create(action: AgentAction): Promise<void>;
  update(id: string, updates: Partial<AgentAction>): Promise<void>;
}

export interface AgentRuntimeConfig {
  runStore: AgentRunStore;
  actionStore: AgentActionStore;
  auditService: AuditService;
  approvalService: ApprovalService;
}

export interface ExecuteAgentOptions {
  agentId: string;
  triggeredBy?: string;
  input: Record<string, unknown>;
  correlationId?: string;
  execute: (definition: AgentDefinition, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export class AgentRuntime {
  constructor(private readonly config: AgentRuntimeConfig) {}

  async execute(opts: ExecuteAgentOptions): Promise<AgentRun> {
    const definition = getAgentDefinition(opts.agentId);
    if (!definition) {
      throw new Error(`Agent definition not found: ${opts.agentId}`);
    }

    const runId = generateId();
    const now = nowISO();

    const run: AgentRun = {
      id: runId,
      agentId: opts.agentId,
      triggeredBy: opts.triggeredBy,
      status: 'RUNNING',
      startedAt: now,
      input: opts.input,
      correlationId: opts.correlationId,
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    await this.config.runStore.create(run);

    await this.config.auditService.record({
      actor: opts.agentId,
      actorType: 'AGENT',
      actionType: 'agent.run.started',
      entityType: 'AgentRun',
      entityId: runId,
      result: 'SUCCESS',
      correlationId: opts.correlationId,
    });

    try {
      const output = await opts.execute(definition, opts.input);

      const completed: Partial<AgentRun> = {
        status: 'COMPLETED',
        completedAt: nowISO(),
        output,
        updatedAt: nowISO(),
      };

      await this.config.runStore.update(runId, completed);

      await this.config.auditService.record({
        actor: opts.agentId,
        actorType: 'AGENT',
        actionType: 'agent.run.completed',
        entityType: 'AgentRun',
        entityId: runId,
        result: 'SUCCESS',
        correlationId: opts.correlationId,
      });

      return { ...run, ...completed };
    } catch (error) {
      const failed: Partial<AgentRun> = {
        status: 'FAILED',
        completedAt: nowISO(),
        error: error instanceof Error ? error.message : String(error),
        updatedAt: nowISO(),
      };

      await this.config.runStore.update(runId, failed);

      await this.config.auditService.record({
        actor: opts.agentId,
        actorType: 'AGENT',
        actionType: 'agent.run.failed',
        entityType: 'AgentRun',
        entityId: runId,
        result: 'FAILURE',
        errorMessage: failed.error,
        correlationId: opts.correlationId,
      });

      return { ...run, ...failed };
    }
  }

  async authorizeAction(opts: {
    agentId: string;
    action: string;
    isExternal?: boolean;
    isFinancial?: boolean;
    isFiling?: boolean;
    isDestructive?: boolean;
    isProductionDeployment?: boolean;
    correlationId?: string;
  }): Promise<{ allowed: boolean; requiresApproval: boolean; approvalLevel?: 'A' | 'B' | 'C' | 'D'; reason: string }> {
    const definition = getAgentDefinition(opts.agentId);
    if (!definition) return { allowed: false, requiresApproval: false, reason: 'Unknown agent.' };

    // Check prohibited actions
    const prohibited = definition.prohibitedActions.some((pa) =>
      opts.action.toLowerCase().includes(pa.toLowerCase())
    );
    if (prohibited) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Action "${opts.action}" is prohibited for agent "${opts.agentId}".`,
      };
    }

    const decision = evaluateActionPolicy({
      actorRole: 'AI_AGENT',
      actorType: 'AGENT',
      action: opts.action,
      isExternal: opts.isExternal,
      isFinancial: opts.isFinancial,
      isFiling: opts.isFiling,
      isDestructive: opts.isDestructive,
      isProductionDeployment: opts.isProductionDeployment,
    });

    return {
      allowed: decision.allowed,
      requiresApproval: decision.requiresApproval ?? false,
      approvalLevel: decision.approvalLevel,
      reason: decision.reason,
    };
  }
}
