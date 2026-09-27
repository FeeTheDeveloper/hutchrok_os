/**
 * Site Autopilot bootstrap — wires the engine, mailbox connector, approvals,
 * audit, and the beat from environment configuration.
 *
 * Persistence is in-memory until the Postgres stores land (Phase 2); the
 * tables already exist in infrastructure/database/schema.ts.
 */

import { AIGateway, AnthropicProvider, ModelRouter, OpenAIProvider, type ModelProfile } from '@hutchrok-os/ai';
import { InMemoryApprovalStore } from '@hutchrok-os/approvals';
import { AuditService, InMemoryAuditSink } from '@hutchrok-os/audit';
import {
  AutopilotBeat,
  AutopilotEngine,
  InMemoryAutopilotStore,
  InMemoryEventPublisher,
  createTextGenerationDrafter,
  type ReplyDrafter,
} from '@hutchrok-os/autopilot';
import { MockEmailConnector, ResendEmailConnector, type EmailConnector } from '@hutchrok-os/connectors';
import { modelRoutingFallback, modelRoutingRules } from '@hutchrok-os/config/model-routing';

export const DEFAULT_OS_MAILBOX = 'repo_addy@hutchrok.com';

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function buildEmailConnector(mailbox: { email: string; name: string }): EmailConnector {
  const apiKey = env('RESEND_API_KEY');
  if (apiKey) return new ResendEmailConnector({ apiKey, mailbox });
  console.warn('[autopilot] RESEND_API_KEY not set — using mock email connector (nothing is delivered).');
  return new MockEmailConnector(mailbox);
}

/** AI drafts are optional; without a provider key the OS drafts holding replies from templates. */
function buildDrafter(): ReplyDrafter | undefined {
  if (env('AUTOPILOT_AI_DRAFTS', 'on') === 'off') return undefined;
  const hasOpenAI = Boolean(env('OPENAI_API_KEY'));
  const hasAnthropic = Boolean(env('ANTHROPIC_API_KEY'));
  if (!hasOpenAI && !hasAnthropic) return undefined;

  const gateway = new AIGateway(new ModelRouter({ rules: modelRoutingRules, fallback: modelRoutingFallback }));
  if (hasOpenAI) gateway.registerProvider(new OpenAIProvider());
  if (hasAnthropic) gateway.registerProvider(new AnthropicProvider());
  // Routing config: fast_conversation → OpenAI, deep_reasoning → Anthropic.
  const profile: ModelProfile = hasOpenAI ? 'fast_conversation' : 'deep_reasoning';

  return createTextGenerationDrafter(async ({ system, user, correlationId }) => {
    const res = await gateway.generateText({
      capability: 'generateText',
      profile,
      systemPrompt: system,
      userPrompt: user,
      maxTokens: 500,
      temperature: 0.3,
      correlationId,
    });
    return res.text;
  });
}

const mailbox = { email: env('OS_MAILBOX_ADDRESS', DEFAULT_OS_MAILBOX).toLowerCase(), name: env('OS_MAILBOX_NAME', 'Hutchrok Solutions Group') };

export const autopilotStore = new InMemoryAutopilotStore();
export const autopilotAuditSink = new InMemoryAuditSink();
export const autopilotEvents = new InMemoryEventPublisher();
export const emailConnector = buildEmailConnector(mailbox);
const audit = new AuditService(autopilotAuditSink);
const drafter = buildDrafter();

export const autopilot = new AutopilotEngine({
  config: {
    identity: {
      address: mailbox.email,
      displayName: mailbox.name,
      teamInbox: env('OS_TEAM_INBOX', 'contact@hutchrok.com'),
      ownerInbox: env('OS_OWNER_INBOX', 'ceo@hutchrok.com'),
      siteUrl: env('SITE_URL', 'https://hutchrok.com'),
    },
    internalDomains: env('OS_INTERNAL_DOMAINS', 'hutchrok.com').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean),
  },
  store: autopilotStore,
  email: emailConnector,
  audit,
  approvalStore: new InMemoryApprovalStore(),
  events: autopilotEvents,
  ...(drafter ? { drafter } : {}),
});

export const beat = new AutopilotBeat(autopilot, autopilotStore, audit, {
  followUpAfterDays: Number(env('AUTOPILOT_FOLLOWUP_DAYS', '3')),
  maxFollowUps: Number(env('AUTOPILOT_MAX_FOLLOWUPS', '1')),
  approvalDigestAfterHours: Number(env('AUTOPILOT_DIGEST_HOURS', '4')),
});

export function startBeat(): void {
  const intervalMs = Number(env('AUTOPILOT_BEAT_INTERVAL_MS', '300000'));
  if (intervalMs <= 0) return;
  beat.start(intervalMs);
  console.log(`[autopilot] Beat running every ${Math.round(intervalMs / 1000)}s · mailbox ${mailbox.email} · email ${emailConnector.provider} · drafts ${drafter ? 'ai' : 'template'}`);
}
