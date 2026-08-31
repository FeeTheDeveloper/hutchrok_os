/**
 * Company Kernel Types
 *
 * Defines the shape of a Business Action OS company kernel.
 * The Hutchrok kernel lives in config/business/hutchrok.kernel.ts.
 * This type structure is reusable for future Business Action OS deployments.
 */

// ─────────────────────────────────────────
// DATA CLASSIFICATION
// ─────────────────────────────────────────

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | 'SECRET';

// ─────────────────────────────────────────
// APPROVAL LEVELS
// ─────────────────────────────────────────

export type ApprovalLevel = 'A' | 'B' | 'C' | 'D';

export interface ApprovalLevelConfig {
  label: string;
  description: string;
  requiresHuman: boolean;
  requiresPolicy?: boolean;
  roles?: string[];
}

// ─────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────

export const ROLES = [
  'OWNER',
  'EXECUTIVE',
  'ADMIN',
  'MANAGER',
  'EMPLOYEE',
  'CONTRACTOR',
  'FILING_SPECIALIST',
  'MARKETING',
  'DEVELOPER',
  'AI_AGENT',
  'CUSTOMER',
] as const;

export type Role = (typeof ROLES)[number];

// ─────────────────────────────────────────
// SENSITIVE REFERENCE
// A reference to a sensitive value stored in an environment variable.
// Never embed the actual value in config.
// ─────────────────────────────────────────

export interface SensitiveRef {
  classification: DataClassification;
  envRef: string;
}

// ─────────────────────────────────────────
// COMPANY KERNEL
// ─────────────────────────────────────────

export interface CompanyKernel {
  identity: {
    businessId: string;
    legalName: string;
    tradeName: string;
    owner: string;
    ownerAlias?: string;
    engineeringAuthority?: string;
    ein: SensitiveRef;
    stateOfFormation: string;
    entityType: string;
    timezone: string;
    website: string;
    version: string;
  };

  contact: {
    emailPrimary: string;
    emailSupport?: string;
    phone: string;
    address: string;
    workspaceDomain?: string;
  };

  divisions: Array<{
    id: string;
    name: string;
    description: string;
  }>;

  customerClasses: Array<{
    id: string;
    name: string;
    description: string;
    eligibilityRequired?: boolean;
  }>;

  brand: {
    voice: string[];
    prohibitedTones: string[];
    colorPrimary?: string;
    logoRef?: string;
  };

  operatingRules: Array<{
    id: string;
    rule: string;
  }>;

  complianceBoundaries: Array<{
    id: string;
    rule: string;
  }>;

  aiPermissions: {
    defaultDataClassificationAllowed: DataClassification;
    requiresApprovalForClassification: DataClassification;
    prohibitedClassifications: DataClassification[];
    requiresRedactionBefore: string[];
    modelUsageRequiresAudit: boolean;
    agentActionRequiresApproval: {
      externalAction: boolean;
      financialAction: boolean;
      communicationAction: boolean | 'policy_controlled';
      filingSubmission: boolean;
    };
  };

  approvalThresholds: {
    levelA: ApprovalLevelConfig;
    levelB: ApprovalLevelConfig;
    levelC: ApprovalLevelConfig;
    levelD: ApprovalLevelConfig;
  };

  connectors: {
    [key: string]: {
      enabled: boolean;
      [key: string]: unknown;
    };
  };

  environments: {
    active: string[];
    productionRequiresApproval: boolean;
    rollbackSupported: boolean;
  };
}
