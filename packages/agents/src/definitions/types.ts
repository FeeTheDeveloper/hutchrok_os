/**
 * Hutchrok OS — Agent Definition Types
 *
 * Every agent definition must contain:
 * - role, purpose, permissions, accessible tools, accessible data
 * - escalation rules, model profile, autonomy level
 * - prohibited actions, logging requirements
 */

import type { Role } from '@hutchrok-os/kernel';
import type { ModelProfile } from '@hutchrok-os/ai';

export type AutonomyLevel = 'SUPERVISED' | 'SEMI_AUTONOMOUS' | 'AUTONOMOUS';

export interface AgentDefinition {
  id: string;
  name: string;
  role: Role;
  purpose: string;
  permissions: string[];
  accessibleTools: string[];
  accessibleData: string[];
  escalationRules: EscalationRule[];
  modelProfile: ModelProfile;
  autonomyLevel: AutonomyLevel;
  prohibitedActions: string[];
  loggingRequirements: LoggingRequirement[];
  approvalLevel: 'A' | 'B' | 'C' | 'D';
}

export interface EscalationRule {
  condition: string;
  escalateTo: string;
  approvalLevel?: 'C' | 'D';
}

export interface LoggingRequirement {
  event: string;
  required: boolean;
  includePayload?: boolean;
}
