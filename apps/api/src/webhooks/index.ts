/**
 * Provider webhooks — signed ingestion boundary
 *
 * These endpoints previously accepted and discarded every delivery with
 * `{ received: true }`, which meant a provider event could be silently lost
 * and a replay could be processed twice.
 *
 * Each now does the four things Section 12 requires before anything acts:
 *
 *   1. Refuse when the signing secret is unconfigured (503) — never accept
 *      an unverifiable delivery.
 *   2. Verify the signature (401 on failure) and enforce the replay window.
 *   3. Record a ProviderEventReceipt. A repeat delivery of the same provider
 *      event returns 200 `{ replay: true }` so the provider stops retrying,
 *      and no handler runs a second time.
 *   4. Raise an exception-queue item, because no service handler exists for
 *      these providers yet. Section 15: every action resolves to a typed
 *      workflow *or an explicit unsupported/exception state* — the gap is
 *      visible in the queue rather than swallowed.
 *
 * Handler wiring per provider lands with its lane (Stripe with payments,
 * telephony with P2, GitHub with engineering). The provider selections in
 * Section 18 are still open.
 */

import { Hono } from 'hono';
import { verifyHmacSignature } from '@hutchrok-os/connectors';
import type { ExceptionReason } from '@hutchrok-os/domain';
import { createActivity, type ActivityChannel } from '@hutchrok-os/events';
import { generateCorrelationId } from '@hutchrok-os/shared';

import {
  HUTCHROK_BINDING,
  REPLAY_WINDOW_MS,
  exceptions,
  receipts,
} from '../activity.js';
import { rateLimit } from '../middleware/security.js';

export const webhooksRouter = new Hono();

const limiter = rateLimit({ prefix: 'provider-webhook', limit: 300, windowMs: 60_000 });

interface ProviderSpec {
  /** Path segment and receipt provider key. */
  provider: string;
  secretEnv: string;
  channel: ActivityChannel;
  eventType: string;
  ownerRole: string;
  /** Pulls the provider's own event id out of the payload, for idempotency. */
  eventId: (payload: unknown, headers: Headers) => string | null;
  verify: (opts: { secret: string; rawBody: string; headers: Headers }) => boolean;
}

// ─────────────────────────────────────────
// SIGNATURE SCHEMES
// ─────────────────────────────────────────

/** Stripe sends `t=<unix>,v1=<hex>`; the signed content is `${t}.${body}`. */
function verifyStripe(opts: { secret: string; rawBody: string; headers: Headers }): boolean {
  const header = opts.headers.get('stripe-signature');
  if (!header) return false;

  let timestamp: string | undefined;
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2);
    if (!k || !v) continue;
    if (k.trim() === 't') timestamp = v.trim();
    if (k.trim() === 'v1') v1.push(v.trim());
  }
  if (!timestamp || v1.length === 0) return false;

  return v1.some((signature) =>
    verifyHmacSignature({
      secret: opts.secret,
      body: opts.rawBody,
      signature,
      timestamp,
      toleranceSeconds: Math.floor(REPLAY_WINDOW_MS / 1000),
    })
  );
}

/** GitHub sends `x-hub-signature-256: sha256=<hex>` over the raw body. */
function verifyGitHub(opts: { secret: string; rawBody: string; headers: Headers }): boolean {
  const signature = opts.headers.get('x-hub-signature-256');
  if (!signature) return false;
  return verifyHmacSignature({ secret: opts.secret, body: opts.rawBody, signature });
}

/** Hutchrok HMAC scheme: `x-hutchrok-signature` + `x-hutchrok-timestamp`. */
function verifyHutchrokHmac(opts: {
  secret: string;
  rawBody: string;
  headers: Headers;
}): boolean {
  const signature = opts.headers.get('x-hutchrok-signature');
  const timestamp = opts.headers.get('x-hutchrok-timestamp');
  if (!signature || !timestamp) return false;
  return verifyHmacSignature({
    secret: opts.secret,
    body: opts.rawBody,
    signature,
    timestamp,
    toleranceSeconds: Math.floor(REPLAY_WINDOW_MS / 1000),
  });
}

// ─────────────────────────────────────────
// PROVIDER TABLE
// ─────────────────────────────────────────

function readString(payload: unknown, key: string): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const PROVIDERS: ProviderSpec[] = [
  {
    provider: 'stripe',
    secretEnv: 'STRIPE_WEBHOOK_SECRET',
    channel: 'internal',
    eventType: 'webhook.received',
    ownerRole: 'Owner',
    eventId: (payload) => readString(payload, 'id'),
    verify: verifyStripe,
  },
  {
    provider: 'google-workspace',
    secretEnv: 'GOOGLE_WEBHOOK_SECRET',
    channel: 'email',
    eventType: 'webhook.received',
    ownerRole: 'Admin',
    // Google push sends the channel/message id in headers, not the body.
    eventId: (payload, headers) =>
      headers.get('x-goog-message-number') ?? readString(payload, 'messageId'),
    verify: verifyHutchrokHmac,
  },
  {
    provider: 'communications',
    secretEnv: 'COMMUNICATIONS_WEBHOOK_SECRET',
    channel: 'sms',
    eventType: 'webhook.received',
    ownerRole: 'Manager',
    eventId: (payload, headers) =>
      readString(payload, 'MessageSid') ??
      readString(payload, 'CallSid') ??
      readString(payload, 'id') ??
      headers.get('x-provider-event-id'),
    verify: verifyHutchrokHmac,
  },
  {
    provider: 'github',
    secretEnv: 'GITHUB_WEBHOOK_SECRET',
    channel: 'internal',
    eventType: 'webhook.received',
    ownerRole: 'Admin',
    eventId: (_payload, headers) => headers.get('x-github-delivery'),
    verify: verifyGitHub,
  },
];

// ─────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────

const UNSUPPORTED: ExceptionReason = 'UNSUPPORTED_REQUEST';

for (const spec of PROVIDERS) {
  webhooksRouter.post(`/${spec.provider}`, limiter, async (c) => {
    const secret = process.env[spec.secretEnv];
    if (!secret) {
      // Never accept a delivery we cannot verify.
      return c.json(
        { error: `${spec.provider} webhooks are not configured`, configured: false },
        503
      );
    }

    const rawBody = await c.req.text();
    const headers = c.req.raw.headers;

    if (!spec.verify({ secret, rawBody, headers })) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    let payload: unknown = null;
    try {
      payload = rawBody.length > 0 ? JSON.parse(rawBody) : null;
    } catch {
      // Form-encoded providers (Twilio) are not JSON; the receipt still
      // hashes the raw body, so idempotency works either way.
      payload = null;
    }

    const providerEventId = spec.eventId(payload, headers);
    if (!providerEventId) {
      return c.json(
        { error: 'Delivery carries no provider event id; cannot guarantee idempotency' },
        400
      );
    }

    const claim = await receipts.claim({
      ...HUTCHROK_BINDING,
      provider: spec.provider,
      providerEventId,
      rawBody,
      signatureVerified: true,
    });

    if (claim.status === 'replay') {
      // 200 so the provider stops retrying; nothing runs again.
      return c.json({
        received: true,
        replay: true,
        replayCount: claim.receipt.replayCount,
        receiptId: claim.receipt.id,
      });
    }

    const correlationId = generateCorrelationId();
    const activity = createActivity({
      event_type: spec.eventType,
      source: `webhook:${spec.provider}`,
      actor: `provider:${spec.provider}`,
      channel: spec.channel,
      data_classification: 'CONFIDENTIAL',
      tenant_id: HUTCHROK_BINDING.tenantId,
      company_id: HUTCHROK_BINDING.companyId,
      provider: spec.provider,
      provider_event_id: providerEventId,
      evidence_ref: `receipt:${claim.receipt.id}`,
      correlation_id: correlationId,
      payload: { payloadHash: claim.receipt.payloadHash },
    });

    await receipts.linkActivity(claim.receipt.id, activity.event_id);

    // No lane handler exists for this provider yet. Make that explicit
    // rather than returning a bare success.
    const item = await exceptions.raise({
      ...HUTCHROK_BINDING,
      reason: UNSUPPORTED,
      severity: 'LOW',
      summary: `Unhandled ${spec.provider} webhook delivery`,
      detail:
        `Verified and recorded, but no service workflow is wired for ${spec.provider} yet. ` +
        'Provider selection and handler wiring are open items (handoff Section 18).',
      activityEventId: activity.event_id,
      ownerRole: spec.ownerRole,
      evidenceRefs: [`receipt:${claim.receipt.id}`],
      correlationId,
    });

    return c.json({
      received: true,
      replay: false,
      handled: false,
      receiptId: claim.receipt.id,
      activityEventId: activity.event_id,
      exceptionId: item.id,
    });
  });
}
