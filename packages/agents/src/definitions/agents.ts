/**
 * Hutchrok OS — Agent Definitions
 *
 * 14 defined agents for Hutchrok Solutions Group LLC.
 * Each agent definition is explicit, bounded, and auditable.
 */

import type { AgentDefinition } from './types.js';

export const hutchrokExecutiveAgent: AgentDefinition = {
  id: 'hutchrok-executive',
  name: 'Hutchrok Executive Agent',
  role: 'AI_AGENT',
  purpose: 'High-level business orchestration, routing decisions, and operational intelligence for King Fee.',
  permissions: ['read:business_metrics', 'read:customer_summaries', 'read:pipeline', 'read:alerts', 'trigger:agent'],
  accessibleTools: ['business.*', 'customers.search', 'customers.get_timeline', 'analytics.*', 'knowledge.search', 'scheduling.*'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'financial_action', escalateTo: 'owner', approvalLevel: 'D' },
    { condition: 'sensitive_customer_data', escalateTo: 'human_review', approvalLevel: 'C' },
  ],
  modelProfile: 'deep_reasoning',
  autonomyLevel: 'SUPERVISED',
  prohibitedActions: [
    'submit_filing', 'move_money', 'delete_records', 'change_ownership',
    'access_secrets', 'production_deploy', 'access_restricted_documents',
  ],
  loggingRequirements: [
    { event: 'any_action', required: true, includePayload: true },
    { event: 'escalation', required: true, includePayload: true },
  ],
  approvalLevel: 'A',
};

export const intakeAgent: AgentDefinition = {
  id: 'intake',
  name: 'Intake Agent',
  role: 'AI_AGENT',
  purpose: 'Guide prospective clients through the intake process, collect required information, and create cases.',
  permissions: ['read:intake_forms', 'write:intake_data', 'create:case', 'send:intake_messages'],
  accessibleTools: ['customers.create', 'customers.update', 'filing.create_case', 'communications.draft_email', 'scheduling.create'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'veteran_eligibility_question', escalateTo: 'compliance-agent' },
    { condition: 'payment_issue', escalateTo: 'finance-agent' },
    { condition: 'human_requested', escalateTo: 'human_review', approvalLevel: 'C' },
  ],
  modelProfile: 'fast_conversation',
  autonomyLevel: 'SEMI_AUTONOMOUS',
  prohibitedActions: [
    'access_veteran_documents', 'submit_filing', 'process_payment', 'access_ssn',
  ],
  loggingRequirements: [
    { event: 'intake_started', required: true },
    { event: 'intake_completed', required: true, includePayload: true },
    { event: 'case_created', required: true, includePayload: true },
  ],
  approvalLevel: 'B',
};

export const filingAgent: AgentDefinition = {
  id: 'filing',
  name: 'Filing Agent',
  role: 'AI_AGENT',
  purpose: 'Prepare, validate, and manage government filing workflows. Must never submit without human approval.',
  permissions: ['read:case', 'write:case_notes', 'read:documents', 'request:document', 'prepare:filing'],
  accessibleTools: ['filing.get_case', 'filing.validate_requirements', 'filing.request_document', 'filing.prepare', 'documents.get', 'documents.request'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'ready_to_submit', escalateTo: 'human_review', approvalLevel: 'C' },
    { condition: 'document_discrepancy', escalateTo: 'human_review', approvalLevel: 'C' },
    { condition: 'state_rejection', escalateTo: 'human_review', approvalLevel: 'C' },
  ],
  modelProfile: 'document_analysis',
  autonomyLevel: 'SUPERVISED',
  prohibitedActions: [
    'submit_filing', // MUST require human Level C approval
    'access_ssn_directly', 'move_money', 'delete_documents',
  ],
  loggingRequirements: [
    { event: 'filing_prepared', required: true, includePayload: true },
    { event: 'document_requested', required: true },
    { event: 'validation_result', required: true, includePayload: true },
  ],
  approvalLevel: 'C',
};

export const complianceAgent: AgentDefinition = {
  id: 'compliance',
  name: 'Compliance Agent',
  role: 'AI_AGENT',
  purpose: 'Monitor compliance deadlines, verify veteran eligibility, and flag compliance risks.',
  permissions: ['read:compliance_data', 'read:deadlines', 'write:compliance_flags', 'send:compliance_alerts'],
  accessibleTools: ['customers.get', 'filing.get_status', 'knowledge.search', 'analytics.get_anomalies'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'missed_deadline', escalateTo: 'human_review', approvalLevel: 'C' },
    { condition: 'legal_question', escalateTo: 'owner', approvalLevel: 'D' },
  ],
  modelProfile: 'deep_reasoning',
  autonomyLevel: 'SUPERVISED',
  prohibitedActions: ['provide_legal_advice', 'submit_filings', 'access_financial_data'],
  loggingRequirements: [
    { event: 'compliance_check', required: true },
    { event: 'deadline_flagged', required: true, includePayload: true },
  ],
  approvalLevel: 'B',
};

export const salesAgent: AgentDefinition = {
  id: 'sales',
  name: 'Sales Agent',
  role: 'AI_AGENT',
  purpose: 'Score leads, suggest next steps, and support the sales pipeline. Never hard-sell blindly.',
  permissions: ['read:leads', 'write:lead_notes', 'read:opportunities', 'write:opportunity_updates'],
  accessibleTools: ['customers.search', 'customers.get', 'customers.get_timeline', 'analytics.get_conversion', 'knowledge.search'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'hot_lead', escalateTo: 'hutchrok-executive', approvalLevel: 'B' },
    { condition: 'custom_pricing_request', escalateTo: 'human_review', approvalLevel: 'C' },
  ],
  modelProfile: 'fast_conversation',
  autonomyLevel: 'SEMI_AUTONOMOUS',
  prohibitedActions: ['create_invoices', 'access_payment_data', 'submit_contracts'],
  loggingRequirements: [
    { event: 'lead_scored', required: true },
    { event: 'opportunity_updated', required: true },
  ],
  approvalLevel: 'B',
};

export const customerServiceAgent: AgentDefinition = {
  id: 'customer-service',
  name: 'Customer Service Agent',
  role: 'AI_AGENT',
  purpose: 'Handle inbound customer inquiries, status updates, and routine follow-ups.',
  permissions: ['read:customer_data', 'read:case_status', 'send:routine_messages', 'create:tasks'],
  accessibleTools: ['customers.get', 'customers.get_timeline', 'filing.get_status', 'communications.draft_email', 'communications.get_conversation'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'unhappy_customer', escalateTo: 'human_review', approvalLevel: 'C' },
    { condition: 'refund_request', escalateTo: 'finance-agent', approvalLevel: 'C' },
    { condition: 'legal_concern', escalateTo: 'owner', approvalLevel: 'D' },
  ],
  modelProfile: 'fast_conversation',
  autonomyLevel: 'SEMI_AUTONOMOUS',
  prohibitedActions: ['process_refunds', 'modify_contracts', 'access_financial_records'],
  loggingRequirements: [
    { event: 'message_sent', required: true, includePayload: true },
    { event: 'escalation', required: true, includePayload: true },
  ],
  approvalLevel: 'B',
};

export const governmentContractingAgent: AgentDefinition = {
  id: 'govcon',
  name: 'Government Contracting Agent',
  role: 'AI_AGENT',
  purpose: 'Identify, score, and support government contracting opportunities for Hutchrok and clients.',
  permissions: ['read:opportunities', 'write:opportunity_notes', 'read:certifications', 'draft:proposals'],
  accessibleTools: ['govcon.search_opportunities', 'govcon.score_opportunity', 'govcon.get_opportunity', 'govcon.get_certification_status', 'govcon.create_proposal_draft', 'knowledge.search'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'bid_submission', escalateTo: 'human_review', approvalLevel: 'C' },
    { condition: 'high_value_contract', escalateTo: 'owner', approvalLevel: 'D' },
  ],
  modelProfile: 'deep_reasoning',
  autonomyLevel: 'SUPERVISED',
  prohibitedActions: ['submit_bids', 'sign_contracts', 'access_financial_data'],
  loggingRequirements: [
    { event: 'opportunity_scored', required: true, includePayload: true },
    { event: 'proposal_drafted', required: true },
  ],
  approvalLevel: 'B',
};

export const marketingAgent: AgentDefinition = {
  id: 'marketing',
  name: 'Marketing Agent',
  role: 'AI_AGENT',
  purpose: 'Support campaign creation, content strategy, and performance analysis.',
  permissions: ['read:campaigns', 'write:campaign_drafts', 'read:analytics', 'draft:content'],
  accessibleTools: ['marketing.create_campaign', 'marketing.get_campaign', 'marketing.generate_content', 'marketing.get_metrics', 'analytics.get_marketing', 'analytics.get_conversion'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'publish_content', escalateTo: 'human_review', approvalLevel: 'C' },
    { condition: 'campaign_budget_change', escalateTo: 'human_review', approvalLevel: 'C' },
  ],
  modelProfile: 'fast_conversation',
  autonomyLevel: 'SEMI_AUTONOMOUS',
  prohibitedActions: ['publish_without_approval', 'access_customer_pii', 'create_paid_campaigns_without_approval'],
  loggingRequirements: [
    { event: 'content_generated', required: true },
    { event: 'campaign_created', required: true, includePayload: true },
  ],
  approvalLevel: 'B',
};

export const creativeAgent: AgentDefinition = {
  id: 'creative',
  name: 'Creative Agent',
  role: 'AI_AGENT',
  purpose: 'Generate creative assets for campaigns, social, and brand use via AI providers.',
  permissions: ['read:brand_guidelines', 'generate:images', 'generate:video_briefs', 'draft:content'],
  accessibleTools: ['marketing.generate_content', 'knowledge.search'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'video_generation', escalateTo: 'human_review', approvalLevel: 'C' },
    { condition: 'brand_deviation', escalateTo: 'human_review', approvalLevel: 'C' },
  ],
  modelProfile: 'creative_image',
  autonomyLevel: 'SEMI_AUTONOMOUS',
  prohibitedActions: ['publish_content_directly', 'access_customer_data'],
  loggingRequirements: [
    { event: 'asset_generated', required: true },
  ],
  approvalLevel: 'C',
};

export const socialAgent: AgentDefinition = {
  id: 'social',
  name: 'Social Agent',
  role: 'AI_AGENT',
  purpose: 'Schedule, draft, and monitor social media content. Never publish without approval.',
  permissions: ['read:social_accounts', 'draft:social_posts', 'read:social_analytics'],
  accessibleTools: ['marketing.schedule_content', 'marketing.get_metrics', 'profiles.get_status'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'publish_ready', escalateTo: 'human_review', approvalLevel: 'C' },
  ],
  modelProfile: 'fast_conversation',
  autonomyLevel: 'SUPERVISED',
  prohibitedActions: ['publish_without_approval', 'access_customer_pii'],
  loggingRequirements: [
    { event: 'post_drafted', required: true },
    { event: 'post_scheduled', required: true },
  ],
  approvalLevel: 'C',
};

export const analyticsAgent: AgentDefinition = {
  id: 'analytics',
  name: 'Analytics Agent',
  role: 'AI_AGENT',
  purpose: 'Generate insights, detect anomalies, and surface actionable intelligence from business data.',
  permissions: ['read:analytics_data', 'read:metrics', 'write:insights', 'trigger:alerts'],
  accessibleTools: ['analytics.*', 'business.get_metrics', 'business.get_health', 'learning.get_daily_digest'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'critical_anomaly', escalateTo: 'hutchrok-executive', approvalLevel: 'B' },
  ],
  modelProfile: 'structured_extraction',
  autonomyLevel: 'AUTONOMOUS',
  prohibitedActions: ['access_individual_customer_pii', 'modify_records'],
  loggingRequirements: [
    { event: 'insight_generated', required: true },
    { event: 'anomaly_detected', required: true, includePayload: true },
  ],
  approvalLevel: 'A',
};

export const financeAgent: AgentDefinition = {
  id: 'finance',
  name: 'Finance Agent',
  role: 'AI_AGENT',
  purpose: 'Monitor invoices, flag payment issues, and prepare financial summaries. Never move money.',
  permissions: ['read:invoices', 'read:payments', 'write:payment_notes', 'flag:payment_issues'],
  accessibleTools: ['payments.get_invoice', 'payments.get_status', 'payments.get_revenue_summary', 'analytics.get_revenue'],
  accessibleData: ['INTERNAL', 'CONFIDENTIAL'],
  escalationRules: [
    { condition: 'refund_request', escalateTo: 'human_review', approvalLevel: 'C' },
    { condition: 'payment_dispute', escalateTo: 'human_review', approvalLevel: 'C' },
    { condition: 'bank_movement', escalateTo: 'owner', approvalLevel: 'D' },
  ],
  modelProfile: 'structured_extraction',
  autonomyLevel: 'SUPERVISED',
  prohibitedActions: ['move_money', 'create_invoices', 'process_refunds_without_approval'],
  loggingRequirements: [
    { event: 'financial_summary_generated', required: true },
    { event: 'payment_flagged', required: true, includePayload: true },
  ],
  approvalLevel: 'C',
};

export const knowledgeAgent: AgentDefinition = {
  id: 'knowledge',
  name: 'Knowledge Agent',
  role: 'AI_AGENT',
  purpose: 'Extract learning candidates from operations, manage knowledge retrieval, and support the learning pipeline.',
  permissions: ['read:knowledge_items', 'create:learning_candidates', 'read:audit_logs'],
  accessibleTools: ['knowledge.search', 'knowledge.get', 'knowledge.add_candidate', 'learning.get_daily_digest', 'learning.review_candidates'],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'knowledge_contradiction', escalateTo: 'human_review', approvalLevel: 'C' },
    { condition: 'policy_change', escalateTo: 'owner', approvalLevel: 'D' },
  ],
  modelProfile: 'deep_reasoning',
  autonomyLevel: 'SUPERVISED',
  prohibitedActions: ['approve_knowledge_directly', 'delete_knowledge_items'],
  loggingRequirements: [
    { event: 'learning_candidate_created', required: true, includePayload: true },
    { event: 'knowledge_retrieved', required: true },
  ],
  approvalLevel: 'B',
};

export const claudeEngineeringAgent: AgentDefinition = {
  id: 'claude-engineering',
  name: 'Claude Engineering Agent',
  role: 'AI_AGENT',
  purpose: 'Builder and engineering extension of Fee The Developer. Implements features, scaffolds architecture, writes tests, and prepares previews.',
  permissions: [
    'read:repositories', 'write:branches', 'create:pull_requests', 'read:ci_status',
    'write:code', 'write:tests', 'write:documentation', 'trigger:preview_deploy',
  ],
  accessibleTools: [
    'development.inspect_repository', 'development.inspect_build', 'development.create_engineering_task',
    'development.get_engineering_task', 'development.get_build_status', 'development.get_logs',
    'development.analyze_failure', 'development.deploy_preview', 'development.request_production_deploy',
    'development.get_release_status',
  ],
  accessibleData: ['PUBLIC', 'INTERNAL'],
  escalationRules: [
    { condition: 'production_deploy', escalateTo: 'owner', approvalLevel: 'C' },
    { condition: 'security_policy_change', escalateTo: 'owner', approvalLevel: 'D' },
    { condition: 'destructive_migration', escalateTo: 'owner', approvalLevel: 'D' },
    { condition: 'production_credential_change', escalateTo: 'owner', approvalLevel: 'D' },
  ],
  modelProfile: 'engineering_builder',
  autonomyLevel: 'SUPERVISED',
  prohibitedActions: [
    'production_deploy_without_approval',
    'access_production_secrets',
    'destructive_migration_without_approval',
    'financial_changes',
    'customer_data_modification',
  ],
  loggingRequirements: [
    { event: 'code_change', required: true },
    { event: 'deployment', required: true, includePayload: true },
    { event: 'escalation', required: true, includePayload: true },
  ],
  approvalLevel: 'C',
};

// ─────────────────────────────────────────
// AGENT REGISTRY
// ─────────────────────────────────────────

export const AGENT_DEFINITIONS = [
  hutchrokExecutiveAgent,
  intakeAgent,
  filingAgent,
  complianceAgent,
  salesAgent,
  customerServiceAgent,
  governmentContractingAgent,
  marketingAgent,
  creativeAgent,
  socialAgent,
  analyticsAgent,
  financeAgent,
  knowledgeAgent,
  claudeEngineeringAgent,
] as const;

export function getAgentDefinition(agentId: string) {
  return AGENT_DEFINITIONS.find((a) => a.id === agentId) ?? null;
}
