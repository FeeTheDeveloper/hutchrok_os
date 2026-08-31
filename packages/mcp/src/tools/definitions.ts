/**
 * Hutchrok OS — MCP Core Tool Definitions
 *
 * Initial namespaces: business, customers, filing, payments, communications,
 * scheduling, documents, govcon, marketing, profiles, analytics,
 * knowledge, learning, development, system.
 *
 * All tools call domain services, never direct SQL.
 */

import { z } from 'zod';
import type { MCPToolDefinition } from './registry.js';

// ─────────────────────────────────────────
// BUSINESS NAMESPACE
// ─────────────────────────────────────────

export const businessGetProfile: MCPToolDefinition = {
  name: 'get_profile',
  namespace: 'business',
  description: 'Get the current Hutchrok business profile from the company kernel.',
  inputSchema: z.object({}),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { note: 'Delegates to kernel service — wire up at app bootstrap.' };
  },
};

export const businessGetStatus: MCPToolDefinition = {
  name: 'get_status',
  namespace: 'business',
  description: 'Get the current operational status of the business.',
  inputSchema: z.object({}),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { status: 'operational', note: 'Wire up to status service.' };
  },
};

export const businessGetMetrics: MCPToolDefinition = {
  name: 'get_metrics',
  namespace: 'business',
  description: 'Get key business metrics for the specified period.',
  inputSchema: z.object({
    period: z.enum(['today', 'week', 'month', 'quarter']).default('today'),
  }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to analytics service.' };
  },
};

export const businessGetHealth: MCPToolDefinition = {
  name: 'get_health',
  namespace: 'business',
  description: 'Get system health status including API, queues, workers, and connectors.',
  inputSchema: z.object({}),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { status: 'healthy', note: 'Wire up to observability service.' };
  },
};

export const businessGetCurrentRisks: MCPToolDefinition = {
  name: 'get_current_risks',
  namespace: 'business',
  description: 'Get current flagged risks, alerts, and required actions.',
  inputSchema: z.object({}),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { risks: [], note: 'Wire up to alert service.' };
  },
};

export const businessGetRequiredActions: MCPToolDefinition = {
  name: 'get_required_actions',
  namespace: 'business',
  description: 'Get pending actions that require attention from King Fee or staff.',
  inputSchema: z.object({}),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { actions: [], note: 'Wire up to approval and task services.' };
  },
};

// ─────────────────────────────────────────
// CUSTOMERS NAMESPACE
// ─────────────────────────────────────────

export const customersSearch: MCPToolDefinition = {
  name: 'search',
  namespace: 'customers',
  description: 'Search customers by name, email, phone, or status.',
  inputSchema: z.object({
    query: z.string().min(1),
    status: z.string().optional(),
    limit: z.number().int().positive().max(100).default(20),
  }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { customers: [], note: 'Wire up to customer domain service.' };
  },
};

export const customersGet: MCPToolDefinition = {
  name: 'get',
  namespace: 'customers',
  description: 'Get full customer record by ID.',
  inputSchema: z.object({ customerId: z.string().uuid() }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to customer domain service.' };
  },
};

export const customersCreate: MCPToolDefinition = {
  name: 'create',
  namespace: 'customers',
  description: 'Create a new customer record.',
  inputSchema: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    customerClass: z.string(),
    source: z.string().optional(),
  }),
  riskLevel: 'MEDIUM',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to customer domain service.' };
  },
};

export const customersGetTimeline: MCPToolDefinition = {
  name: 'get_timeline',
  namespace: 'customers',
  description: 'Get the full activity timeline for a customer.',
  inputSchema: z.object({
    customerId: z.string().uuid(),
    limit: z.number().int().positive().max(100).default(50),
  }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { events: [], note: 'Wire up to event/audit service.' };
  },
};

// ─────────────────────────────────────────
// FILING NAMESPACE
// ─────────────────────────────────────────

export const filingCreateCase: MCPToolDefinition = {
  name: 'create_case',
  namespace: 'filing',
  description: 'Create a new veteran filing case.',
  inputSchema: z.object({
    customerId: z.string().uuid(),
    type: z.string().default('veteran_formation'),
    notes: z.string().optional(),
  }),
  riskLevel: 'MEDIUM',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to filing domain service.' };
  },
};

export const filingGetCase: MCPToolDefinition = {
  name: 'get_case',
  namespace: 'filing',
  description: 'Get a filing case by ID.',
  inputSchema: z.object({ caseId: z.string().uuid() }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to filing domain service.' };
  },
};

export const filingAdvance: MCPToolDefinition = {
  name: 'advance',
  namespace: 'filing',
  description: 'Advance a filing case to the next state. Enforces valid state transitions.',
  inputSchema: z.object({
    caseId: z.string().uuid(),
    toState: z.string(),
    notes: z.string().optional(),
  }),
  riskLevel: 'HIGH',
  requiresApproval: true,
  approvalLevel: 'C',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to filing state machine with Level C approval enforcement.' };
  },
};

export const filingRequestCustomerApproval: MCPToolDefinition = {
  name: 'request_customer_approval',
  namespace: 'filing',
  description: 'Request customer approval before filing submission.',
  inputSchema: z.object({
    caseId: z.string().uuid(),
    message: z.string().optional(),
  }),
  riskLevel: 'MEDIUM',
  requiresApproval: true,
  approvalLevel: 'B',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to communications + approval service.' };
  },
};

// ─────────────────────────────────────────
// PAYMENTS NAMESPACE
// ─────────────────────────────────────────

export const paymentsGetRevenueSummary: MCPToolDefinition = {
  name: 'get_revenue_summary',
  namespace: 'payments',
  description: 'Get revenue summary for the specified period.',
  inputSchema: z.object({
    period: z.enum(['today', 'week', 'month', 'quarter', 'year']).default('month'),
  }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to payment domain service.' };
  },
};

export const paymentsRequestRefund: MCPToolDefinition = {
  name: 'request_refund',
  namespace: 'payments',
  description: 'Request a refund for a payment. Requires Level C approval.',
  inputSchema: z.object({
    paymentId: z.string().uuid(),
    amount: z.number().positive().optional(),
    reason: z.string(),
  }),
  riskLevel: 'HIGH',
  requiresApproval: true,
  approvalLevel: 'C',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to payment service with Level C approval.' };
  },
};

// ─────────────────────────────────────────
// COMMUNICATIONS NAMESPACE
// ─────────────────────────────────────────

export const communicationsGetUnanswered: MCPToolDefinition = {
  name: 'get_unanswered',
  namespace: 'communications',
  description: 'Get all unanswered inbound communications.',
  inputSchema: z.object({
    channel: z.enum(['email', 'sms', 'voice', 'all']).default('all'),
    limit: z.number().int().positive().max(100).default(20),
  }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { messages: [], note: 'Wire up to communications service.' };
  },
};

export const communicationsSendEmail: MCPToolDefinition = {
  name: 'send_email',
  namespace: 'communications',
  description: 'Send an email to a customer. Requires policy approval for non-routine messages.',
  inputSchema: z.object({
    customerId: z.string().uuid(),
    subject: z.string(),
    body: z.string(),
    isRoutine: z.boolean().default(false),
  }),
  riskLevel: 'MEDIUM',
  requiresApproval: true,
  approvalLevel: 'B',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to communications connector with policy check.' };
  },
};

export const communicationsSendSms: MCPToolDefinition = {
  name: 'send_sms',
  namespace: 'communications',
  description: 'Send an SMS to a customer.',
  inputSchema: z.object({
    customerId: z.string().uuid(),
    body: z.string().max(1600),
    isRoutine: z.boolean().default(false),
  }),
  riskLevel: 'MEDIUM',
  requiresApproval: true,
  approvalLevel: 'B',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to communications connector with policy check.' };
  },
};

// ─────────────────────────────────────────
// GOVCON NAMESPACE
// ─────────────────────────────────────────

export const govconSearchOpportunities: MCPToolDefinition = {
  name: 'search_opportunities',
  namespace: 'govcon',
  description: 'Search SAM.gov and other sources for government contracting opportunities.',
  inputSchema: z.object({
    keywords: z.string().optional(),
    naicsCode: z.string().optional(),
    setAside: z.string().optional(),
    limit: z.number().int().positive().max(50).default(10),
  }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { opportunities: [], note: 'Wire up to GovCon connector.' };
  },
};

export const govconCreateBidDecision: MCPToolDefinition = {
  name: 'create_bid_decision',
  namespace: 'govcon',
  description: 'Create a bid/no-bid decision for an opportunity.',
  inputSchema: z.object({
    opportunityId: z.string().uuid(),
    decision: z.enum(['BID', 'NO_BID']),
    rationale: z.string(),
  }),
  riskLevel: 'HIGH',
  requiresApproval: true,
  approvalLevel: 'C',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to GovCon domain service with Level C approval.' };
  },
};

// ─────────────────────────────────────────
// ANALYTICS NAMESPACE
// ─────────────────────────────────────────

export const analyticsGetDaily: MCPToolDefinition = {
  name: 'get_daily',
  namespace: 'analytics',
  description: 'Get the daily operational summary.',
  inputSchema: z.object({
    date: z.string().optional(),
  }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to analytics service.' };
  },
};

export const analyticsGetAnomalies: MCPToolDefinition = {
  name: 'get_anomalies',
  namespace: 'analytics',
  description: 'Get detected anomalies across business operations.',
  inputSchema: z.object({
    severity: z.enum(['all', 'WARNING', 'ERROR', 'CRITICAL']).default('all'),
  }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { anomalies: [], note: 'Wire up to analytics service.' };
  },
};

// ─────────────────────────────────────────
// KNOWLEDGE NAMESPACE
// ─────────────────────────────────────────

export const knowledgeSearch: MCPToolDefinition = {
  name: 'search',
  namespace: 'knowledge',
  description: 'Search the Hutchrok knowledge base.',
  inputSchema: z.object({
    query: z.string(),
    type: z.string().optional(),
    limit: z.number().int().positive().max(20).default(5),
  }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { items: [], note: 'Wire up to knowledge service.' };
  },
};

export const knowledgeAddCandidate: MCPToolDefinition = {
  name: 'add_candidate',
  namespace: 'knowledge',
  description: 'Add a learning candidate to the knowledge pipeline for review.',
  inputSchema: z.object({
    sourceType: z.string(),
    title: z.string(),
    content: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  riskLevel: 'MEDIUM',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to learning service.' };
  },
};

// ─────────────────────────────────────────
// DEVELOPMENT NAMESPACE
// ─────────────────────────────────────────

export const developmentInspectRepository: MCPToolDefinition = {
  name: 'inspect_repository',
  namespace: 'development',
  description: 'Inspect the current state of the Hutchrok OS repository.',
  inputSchema: z.object({
    path: z.string().optional(),
  }),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to GitHub integration service.' };
  },
};

export const developmentRequestProductionDeploy: MCPToolDefinition = {
  name: 'request_production_deploy',
  namespace: 'development',
  description: 'Request a production deployment. Requires Level C human approval from Fee.',
  inputSchema: z.object({
    version: z.string(),
    releaseNotes: z.string(),
    gitSha: z.string(),
  }),
  riskLevel: 'CRITICAL',
  requiresApproval: true,
  approvalLevel: 'C',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to deployment service with Level C approval enforcement.' };
  },
};

export const developmentRollback: MCPToolDefinition = {
  name: 'rollback',
  namespace: 'development',
  description: 'Rollback the current production deployment. Requires Level C approval.',
  inputSchema: z.object({
    deploymentId: z.string().uuid(),
    reason: z.string(),
  }),
  riskLevel: 'CRITICAL',
  requiresApproval: true,
  approvalLevel: 'C',
  handler: async (_input, _ctx) => {
    return { note: 'Wire up to deployment service with Level C approval.' };
  },
};

// ─────────────────────────────────────────
// SYSTEM NAMESPACE
// ─────────────────────────────────────────

export const systemGetHealth: MCPToolDefinition = {
  name: 'get_health',
  namespace: 'system',
  description: 'Get comprehensive system health status.',
  inputSchema: z.object({}),
  riskLevel: 'LOW',
  handler: async (_input, _ctx) => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  },
};

// ─────────────────────────────────────────
// ALL TOOLS (for registration)
// ─────────────────────────────────────────

export const ALL_MCP_TOOLS: MCPToolDefinition[] = [
  businessGetProfile,
  businessGetStatus,
  businessGetMetrics,
  businessGetHealth,
  businessGetCurrentRisks,
  businessGetRequiredActions,
  customersSearch,
  customersGet,
  customersCreate,
  customersGetTimeline,
  filingCreateCase,
  filingGetCase,
  filingAdvance,
  filingRequestCustomerApproval,
  paymentsGetRevenueSummary,
  paymentsRequestRefund,
  communicationsGetUnanswered,
  communicationsSendEmail,
  communicationsSendSms,
  govconSearchOpportunities,
  govconCreateBidDecision,
  analyticsGetDaily,
  analyticsGetAnomalies,
  knowledgeSearch,
  knowledgeAddCandidate,
  developmentInspectRepository,
  developmentRequestProductionDeploy,
  developmentRollback,
  systemGetHealth,
];
