/**
 * Hutchrok OS — Policy Engine
 *
 * Policies decide:
 * - whether an agent can read data
 * - whether an agent can perform an action
 * - whether approval is required
 * - what data can be sent to a model
 * - what data must be redacted
 * - which model class is permitted
 * - whether an external action is safe
 * - whether a workflow should escalate
 *
 * Policy decisions are explicit structured results — never silent.
 */

import type { DataClassification, Role } from '@hutchrok-os/kernel';
import { getKernel } from '@hutchrok-os/kernel';

// ─────────────────────────────────────────
// POLICY DECISION
// ─────────────────────────────────────────

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  requiresApproval?: boolean;
  approvalLevel?: 'A' | 'B' | 'C' | 'D';
  requiresRedaction?: boolean;
  redactFields?: string[];
  escalate?: boolean;
  metadata?: Record<string, unknown>;
}

export type PolicyResult = PolicyDecision;

// ─────────────────────────────────────────
// POLICY CONTEXT
// ─────────────────────────────────────────

export interface PolicyContext {
  actor: string;
  actorRole: Role;
  actorType: 'USER' | 'AGENT' | 'SYSTEM';
  agentId?: string;
  dataClassification?: DataClassification;
  action?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────
// POLICY EVALUATOR INTERFACE
// ─────────────────────────────────────────

export interface PolicyEvaluator {
  name: string;
  evaluate(context: PolicyContext): Promise<PolicyDecision>;
}

// ─────────────────────────────────────────
// DATA ACCESS POLICY
// ─────────────────────────────────────────

export function evaluateDataAccessPolicy(context: PolicyContext): PolicyDecision {
  const kernel = getKernel();
  const classification = context.dataClassification ?? 'PUBLIC';

  const prohibited = kernel.aiPermissions.prohibitedClassifications;

  if (context.actorType === 'AGENT') {
    if ((prohibited as string[]).includes(classification)) {
      return {
        allowed: false,
        reason: `Agents may not access data classified as ${classification}.`,
        requiresRedaction: true,
      };
    }
    if (
      classification === kernel.aiPermissions.requiresApprovalForClassification ||
      classification === 'CONFIDENTIAL'
    ) {
      return {
        allowed: true,
        reason: `Agent access to ${classification} data requires approval.`,
        requiresApproval: true,
        approvalLevel: 'C',
      };
    }
  }

  // RESTRICTED / SECRET requires human auth regardless of actor type
  if (classification === 'RESTRICTED' || classification === 'SECRET') {
    if (context.actorRole !== 'OWNER' && context.actorRole !== 'EXECUTIVE') {
      return {
        allowed: false,
        reason: `Access to ${classification} data requires OWNER or EXECUTIVE role.`,
      };
    }
  }

  return { allowed: true, reason: 'Access permitted by policy.' };
}

// ─────────────────────────────────────────
// ACTION AUTHORIZATION POLICY
// ─────────────────────────────────────────

export interface ActionPolicyContext {
  actorRole: Role;
  actorType: 'USER' | 'AGENT';
  action: string;
  isExternal?: boolean;
  isFinancial?: boolean;
  isFiling?: boolean;
  isCommunication?: boolean;
  isDestructive?: boolean;
  isProductionDeployment?: boolean;
}

export function evaluateActionPolicy(context: ActionPolicyContext): PolicyDecision {
  // Level D — Owner only
  const levelDActions = ['bank_movement', 'ownership_change', 'emergency_shutdown', 'production_secrets'];
  if (levelDActions.some((a) => context.action.includes(a))) {
    if (context.actorRole !== 'OWNER') {
      return {
        allowed: false,
        reason: `Action "${context.action}" requires Level D (Owner-only) approval.`,
        requiresApproval: true,
        approvalLevel: 'D',
      };
    }
  }

  // Production deployment
  if (context.isProductionDeployment) {
    return {
      allowed: true,
      reason: 'Production deployment requires Level C approval.',
      requiresApproval: true,
      approvalLevel: 'C',
    };
  }

  // Filing submission
  if (context.isFiling) {
    return {
      allowed: true,
      reason: 'Filing submission requires Level C human approval.',
      requiresApproval: true,
      approvalLevel: 'C',
    };
  }

  // Financial actions
  if (context.isFinancial) {
    if (context.actorType === 'AGENT') {
      return {
        allowed: true,
        reason: 'Financial agent actions require Level C approval.',
        requiresApproval: true,
        approvalLevel: 'C',
      };
    }
  }

  // External actions by agents
  if (context.isExternal && context.actorType === 'AGENT') {
    return {
      allowed: true,
      reason: 'External agent actions require Level B policy check.',
      requiresApproval: true,
      approvalLevel: 'B',
    };
  }

  return { allowed: true, reason: 'Action permitted by policy.' };
}

// ─────────────────────────────────────────
// MODEL USAGE POLICY
// ─────────────────────────────────────────

export interface ModelUsagePolicyContext {
  requestedCapability: string;
  dataClassification: DataClassification;
  sensitiveFields?: string[];
}

export function evaluateModelUsagePolicy(context: ModelUsagePolicyContext): PolicyDecision {
  const kernel = getKernel();

  const prohibited = kernel.aiPermissions.prohibitedClassifications as string[];

  if (prohibited.includes(context.dataClassification)) {
    return {
      allowed: false,
      reason: `Data classified as ${context.dataClassification} must not be sent to AI models.`,
      requiresRedaction: true,
      redactFields: context.sensitiveFields ?? [],
    };
  }

  if (context.dataClassification === 'CONFIDENTIAL') {
    return {
      allowed: true,
      reason: 'CONFIDENTIAL data requires redaction of sensitive fields before model submission.',
      requiresRedaction: true,
      redactFields: context.sensitiveFields ?? [],
    };
  }

  return {
    allowed: true,
    reason: 'Model usage permitted.',
    requiresRedaction: false,
  };
}
