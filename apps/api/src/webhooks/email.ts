/**
 * OS mailbox inbound webhooks
 *
 * POST /webhooks/email/resend   — Resend inbound (`email.received`), Svix-signed
 *                                 with RESEND_WEBHOOK_SECRET.
 * POST /webhooks/email/inbound  — Generic forwarder (Google Apps Script on the
 *                                 Workspace mailbox, see infrastructure/google/),
 *                                 HMAC-signed with EMAIL_INBOUND_SECRET.
 *
 * Both normalize into InboundEmail and hand off to the autopilot.
 */

import { Hono } from 'hono';
import {
  InboundEmailSchema,
  ResendEmailConnector,
  parseResendInbound,
  verifyHmacSignature,
  verifySvixSignature,
  type InboundEmail,
} from '@hutchrok-os/connectors';
import { autopilot, emailConnector } from '../autopilot.js';
import { rateLimit } from '../middleware/security.js';

export const emailWebhooksRouter = new Hono();

const limiter = rateLimit({ prefix: 'email-inbound', limit: 300, windowMs: 60_000 });

function summarize(run: Awaited<ReturnType<typeof autopilot.handleInboundEmail>>) {
  return {
    runId: run.runId,
    duplicate: run.duplicate,
    intent: run.intent,
    actions: run.actions.map((a) => ({ kind: a.kind, status: a.status })),
  };
}

emailWebhooksRouter.post('/resend', limiter, async (c) => {
  const secret = process.env['RESEND_WEBHOOK_SECRET'];
  if (!secret) return c.json({ error: 'Resend inbound is not configured' }, 503);

  const rawBody = await c.req.text();
  const valid = verifySvixSignature({
    secret,
    body: rawBody,
    svixId: c.req.header('svix-id') ?? '',
    svixTimestamp: c.req.header('svix-timestamp') ?? '',
    svixSignature: c.req.header('svix-signature') ?? '',
  });
  if (!valid) return c.json({ error: 'Invalid signature' }, 401);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  let email: InboundEmail | null = parseResendInbound(payload);
  if (!email) return c.json({ received: true, ignored: true });

  // Resend inbound webhooks carry metadata only; hydrate the body.
  if (!email.text && !email.html && emailConnector instanceof ResendEmailConnector) {
    const full = await emailConnector.fetchReceived(email.providerMessageId);
    if (full) {
      const headers = { ...email.headers, ...(full.headers ?? {}) };
      email = {
        ...email,
        text: full.text ?? email.text,
        ...(full.html !== undefined ? { html: full.html } : {}),
        headers,
        ...(headers['in-reply-to'] && !email.inReplyTo ? { inReplyTo: headers['in-reply-to'] } : {}),
        ...(headers['message-id'] && !email.internetMessageId ? { internetMessageId: headers['message-id'] } : {}),
      };
    }
  }
  if (!email.text && email.html) {
    email = { ...email, text: email.html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
  }

  return c.json(summarize(await autopilot.handleInboundEmail(email)), 202);
});

emailWebhooksRouter.post('/inbound', limiter, async (c) => {
  const secret = process.env['EMAIL_INBOUND_SECRET'];
  if (!secret) return c.json({ error: 'Email inbound is not configured' }, 503);

  const rawBody = await c.req.text();
  const valid = verifyHmacSignature({
    secret,
    body: rawBody,
    signature: c.req.header('x-hutchrok-signature') ?? '',
    timestamp: c.req.header('x-hutchrok-timestamp') ?? '',
  });
  if (!valid) return c.json({ error: 'Invalid signature' }, 401);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const parsed = InboundEmailSchema.safeParse(payload);
  if (!parsed.success) return c.json({ error: 'Invalid email payload', details: parsed.error.issues }, 400);

  const email = { ...parsed.data, from: parsed.data.from.toLowerCase() };
  return c.json(summarize(await autopilot.handleInboundEmail(email)), 202);
});
