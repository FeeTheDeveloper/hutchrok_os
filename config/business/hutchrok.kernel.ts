/**
 * Hutchrok Solutions Group LLC — Company Kernel
 *
 * This is the machine-readable authoritative identity and configuration
 * for the Hutchrok Business Action OS. It defines who Hutchrok is,
 * what it does, how it operates, and what boundaries apply.
 *
 * NEVER embed secrets, credentials, or tokens in this file.
 * All sensitive references point to environment variable names only.
 */

import type { CompanyKernel } from '@hutchrok-os/kernel';

export const hutchrokKernel: CompanyKernel = {
  // ──────────────────────────────────────────────
  // IDENTITY
  // ──────────────────────────────────────────────
  identity: {
    businessId: 'hutchrok-solutions-group',
    legalName: 'Hutchrok Solutions Group LLC',
    tradeName: 'Hutchrok',
    owner: 'Alfreddie Postell II',
    ownerAlias: 'King Fee',
    engineeringAuthority: 'Fee The Developer',
    ein: { classification: 'RESTRICTED', envRef: 'HUTCHROK_EIN' },
    stateOfFormation: 'PLACEHOLDER — confirm with owner',
    entityType: 'LLC',
    timezone: 'America/New_York',
    website: 'https://hutchrok.com',
    version: '1.0.0',
  },

  // ──────────────────────────────────────────────
  // PUBLIC CONTACT
  // ──────────────────────────────────────────────
  contact: {
    emailPrimary: 'info@hutchrok.com',
    emailSupport: 'support@hutchrok.com',
    phone: 'PLACEHOLDER — confirm business phone',
    address: 'PLACEHOLDER — confirm mailing address',
    workspaceDomain: 'hutchrok.com',
  },

  // ──────────────────────────────────────────────
  // DIVISIONS
  // ──────────────────────────────────────────────
  divisions: [
    {
      id: 'veteran-services',
      name: 'Veteran Business Services',
      description: 'Business formation and support for veteran entrepreneurs',
    },
    {
      id: 'managed-services',
      name: 'Managed Business Services',
      description: 'Registered agent, compliance, and ongoing business management',
    },
    {
      id: 'technology',
      name: 'Technology Services',
      description: 'Web/app development, AI, automation, and infrastructure',
    },
    {
      id: 'marketing',
      name: 'Marketing & Creative',
      description: 'Digital marketing, branding, content, and campaigns',
    },
    {
      id: 'govcon',
      name: 'Government Contracting',
      description: 'SAM.gov, certifications, bids, and contract pipeline',
    },
    {
      id: 'consulting',
      name: 'Strategic Consulting',
      description: 'Business intelligence, strategy, and advisory services',
    },
    {
      id: 'business-action-os',
      name: 'Business Action OS',
      description: 'Custom operational OS implementations for other businesses',
    },
  ],

  // ──────────────────────────────────────────────
  // CUSTOMER CLASSES
  // ──────────────────────────────────────────────
  customerClasses: [
    {
      id: 'veteran-entrepreneur',
      name: 'Veteran Entrepreneur',
      description: 'Service-connected or honorably discharged veteran starting a business',
      eligibilityRequired: true,
    },
    {
      id: 'small-business',
      name: 'Small Business',
      description: 'Non-veteran small business owner seeking services',
    },
    {
      id: 'membership',
      name: 'Membership Client',
      description: 'Active Hutchrok membership subscriber',
    },
    {
      id: 'govcon-client',
      name: 'Government Contracting Client',
      description: 'Business pursuing government contracts',
    },
    {
      id: 'managed-client',
      name: 'Managed Services Client',
      description: 'Active registered agent / compliance client',
    },
    {
      id: 'technology-client',
      name: 'Technology Client',
      description: 'Web, app, AI, or automation project client',
    },
    {
      id: 'consulting-client',
      name: 'Consulting Client',
      description: 'Strategic consulting or BI engagement client',
    },
    {
      id: 'bas-client',
      name: 'Business Action OS Client',
      description: 'Business receiving a custom Business Action OS implementation',
    },
  ],

  // ──────────────────────────────────────────────
  // BRAND ATTRIBUTES
  // ──────────────────────────────────────────────
  brand: {
    voice: [
      'authoritative',
      'mission-driven',
      'precise',
      'action-oriented',
      'veteran-respectful',
    ],
    prohibitedTones: ['condescending', 'salesy', 'generic', 'bureaucratic'],
    colorPrimary: 'PLACEHOLDER — confirm brand color',
    logoRef: 'PLACEHOLDER — confirm logo storage path',
  },

  // ──────────────────────────────────────────────
  // OPERATING RULES
  // ──────────────────────────────────────────────
  operatingRules: [
    {
      id: 'no-unsolicited-upsell',
      rule: 'Never promote paid services without confirmed customer eligibility and interest.',
    },
    {
      id: 'veteran-first-service',
      rule: 'Veterans receive priority queue treatment and mission-first framing.',
    },
    {
      id: 'human-approval-for-filings',
      rule: 'No government filing may be submitted without explicit human approval.',
    },
    {
      id: 'no-sensitive-data-in-ai',
      rule: 'SSN, EIN documents, bank data, and veteran records must not be sent to external AI models without explicit policy authorization.',
    },
    {
      id: 'owner-only-financial',
      rule: 'Bank movements and financial authority changes require Owner (King Fee) approval only.',
    },
    {
      id: 'audit-all-consequential-actions',
      rule: 'Every consequential action — agent or human — must produce an audit record.',
    },
    {
      id: 'learning-governed',
      rule: 'Operational activity may not directly rewrite company knowledge. All learning must pass the validation pipeline.',
    },
  ],

  // ──────────────────────────────────────────────
  // COMPLIANCE BOUNDARIES
  // ──────────────────────────────────────────────
  complianceBoundaries: [
    { id: 'no-legal-advice', rule: 'Do not provide legal advice. Refer to qualified counsel.' },
    { id: 'no-financial-advice', rule: 'Do not provide investment or tax advice. Refer to qualified professionals.' },
    { id: 'veteran-data-protection', rule: 'Veteran service records and DD-214 documents are RESTRICTED and must be treated accordingly.' },
    { id: 'no-unauthorized-disbursement', rule: 'No money movement without Level D approval.' },
    { id: 'gdpr-ccpa-aware', rule: 'Handle personal data in compliance with applicable privacy laws.' },
  ],

  // ──────────────────────────────────────────────
  // AI PERMISSIONS
  // ──────────────────────────────────────────────
  aiPermissions: {
    defaultDataClassificationAllowed: 'INTERNAL',
    requiresApprovalForClassification: 'CONFIDENTIAL',
    prohibitedClassifications: ['RESTRICTED', 'SECRET'],
    requiresRedactionBefore: ['model_context', 'mcp_response', 'logs'],
    modelUsageRequiresAudit: true,
    agentActionRequiresApproval: {
      externalAction: true,
      financialAction: true,
      communicationAction: 'policy_controlled',
      filingSubmission: true,
    },
  },

  // ──────────────────────────────────────────────
  // APPROVAL THRESHOLDS
  // ──────────────────────────────────────────────
  approvalThresholds: {
    levelA: {
      label: 'Automatic',
      description: 'Classification, summaries, task creation, routine FAQ, analytics, lead scoring',
      requiresHuman: false,
    },
    levelB: {
      label: 'Policy-Controlled Automation',
      description: 'Reminders, document requests, routine follow-ups, routine status messages, pre-approved social scheduling',
      requiresHuman: false,
      requiresPolicy: true,
    },
    levelC: {
      label: 'Human Approval',
      description: 'Filing submission, refunds, contracts, custom pricing, government bid submission, sensitive communications, production deployment',
      requiresHuman: true,
      roles: ['OWNER', 'EXECUTIVE', 'ADMIN', 'MANAGER'],
    },
    levelD: {
      label: 'Owner/Fee Only',
      description: 'Bank movement, secrets, ownership changes, destructive production actions, major security overrides, high-value contracts, emergency shutdown',
      requiresHuman: true,
      roles: ['OWNER'],
    },
  },

  // ──────────────────────────────────────────────
  // CONNECTORS (references only — no secrets)
  // ──────────────────────────────────────────────
  connectors: {
    googleWorkspace: {
      enabled: true,
      domain: 'hutchrok.com',
      credentialsEnvRef: 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
    },
    stripe: {
      enabled: true,
      mode: 'live',
      apiKeyEnvRef: 'STRIPE_SECRET_KEY',
    },
    communications: {
      enabled: true,
      provider: 'PLACEHOLDER — confirm: twilio | telnyx',
      phoneNumber: 'PLACEHOLDER — confirm business phone number',
    },
    github: {
      enabled: true,
      org: 'FeeTheDeveloper',
      appIdEnvRef: 'GITHUB_APP_ID',
    },
    website: {
      enabled: true,
      domain: 'hutchrok.com',
      ingestionSecretEnvRef: 'WEBSITE_INGESTION_SECRET',
    },
    higgsfield: {
      enabled: false,
      note: 'Creative generation — pending integration',
      apiKeyEnvRef: 'HIGGSFIELD_API_KEY',
    },
  },

  // ──────────────────────────────────────────────
  // ENVIRONMENTS
  // ──────────────────────────────────────────────
  environments: {
    active: ['local', 'dev', 'preview', 'staging', 'production'],
    productionRequiresApproval: true,
    rollbackSupported: true,
  },
};
