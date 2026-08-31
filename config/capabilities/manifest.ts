/**
 * Hutchrok Capability Manifest
 *
 * Versioned list of capabilities offered by Hutchrok Solutions Group LLC.
 * Capabilities can be enabled/disabled without restructuring the application.
 */

export interface Capability {
  id: string;
  name: string;
  division: string;
  description: string;
  enabled: boolean;
  requiresEligibilityCheck?: boolean;
  relatedServices?: string[];
}

export const capabilityManifest: {
  version: string;
  updatedAt: string;
  capabilities: Capability[];
} = {
  version: '1.0.0',
  updatedAt: '2026-08-30',
  capabilities: [
    {
      id: 'veteran-business-services',
      name: 'Veteran Business Services',
      division: 'veteran-services',
      description: 'End-to-end business formation and support exclusively for veteran entrepreneurs',
      enabled: true,
      requiresEligibilityCheck: true,
    },
    {
      id: 'formation-workflows',
      name: 'Business Formation Workflows',
      division: 'veteran-services',
      description: 'State filing, LLC/Corp formation, and entity setup workflows',
      enabled: true,
    },
    {
      id: 'registered-agent',
      name: 'Registered Agent Service',
      division: 'managed-services',
      description: 'Hutchrok as registered agent for client businesses',
      enabled: true,
    },
    {
      id: 'compliance',
      name: 'Compliance Management',
      division: 'managed-services',
      description: 'Annual reports, BOI, and ongoing compliance management',
      enabled: true,
    },
    {
      id: 'memberships',
      name: 'Membership Programs',
      division: 'managed-services',
      description: 'Subscription-based access to bundled Hutchrok services',
      enabled: true,
    },
    {
      id: 'strategic-consulting',
      name: 'Strategic Consulting',
      division: 'consulting',
      description: 'Business strategy, intelligence, and advisory engagements',
      enabled: true,
    },
    {
      id: 'managed-services',
      name: 'Managed Business Services',
      division: 'managed-services',
      description: 'Ongoing business management and operational support',
      enabled: true,
    },
    {
      id: 'technology-services',
      name: 'Technology Services',
      division: 'technology',
      description: 'Technical advisory, architecture, and technology strategy',
      enabled: true,
    },
    {
      id: 'web-app-development',
      name: 'Web & App Development',
      division: 'technology',
      description: 'Custom websites, web apps, and mobile applications',
      enabled: true,
    },
    {
      id: 'ai-automation',
      name: 'AI & Automation',
      division: 'technology',
      description: 'AI implementation, workflow automation, and intelligent systems',
      enabled: true,
    },
    {
      id: 'marketing',
      name: 'Marketing Services',
      division: 'marketing',
      description: 'Digital marketing strategy, execution, and campaign management',
      enabled: true,
    },
    {
      id: 'creative',
      name: 'Creative Services',
      division: 'marketing',
      description: 'Branding, design, video, and creative content production',
      enabled: true,
    },
    {
      id: 'government-contracting',
      name: 'Government Contracting',
      division: 'govcon',
      description: 'SAM.gov, certifications, proposal support, and contract pipeline',
      enabled: true,
    },
    {
      id: 'business-intelligence',
      name: 'Business Intelligence',
      division: 'consulting',
      description: 'Data analysis, reporting, KPIs, and operational insights',
      enabled: true,
    },
    {
      id: 'business-action-os-implementation',
      name: 'Business Action OS Implementation',
      division: 'business-action-os',
      description: 'Custom Business Action OS built for client businesses',
      enabled: true,
    },
  ],
};
