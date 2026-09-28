/**
 * Hutchrok OS — Email Connector
 *
 * Provider-neutral email contract for the OS mailbox. Outbound mail is sent
 * from the OS mailbox and every reply-to points back at it, so all customer
 * replies re-enter the OS through an inbound webhook.
 *
 * Adapters:
 * - ResendEmailConnector — outbound via the Resend REST API (fetch, no SDK)
 * - MockEmailConnector   — records messages in memory for dev/tests
 *
 * Inbound sources:
 * - Resend inbound webhooks (Svix-signed)          → parseResendInbound()
 * - Gmail / Apps Script forwarder (HMAC-signed)    → InboundEmailSchema
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { z } from 'zod';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface OutboundEmail {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
  /** Overrides the connector's default From identity. */
  from?: string;
  /** Defaults to the OS mailbox so replies route back into the OS. */
  replyTo?: string;
  /** Message-ID of the email being replied to (threading). */
  inReplyTo?: string;
  /** Full References chain for threading. */
  references?: string[];
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  correlationId?: string;
}

export interface SendEmailResult {
  /** Provider message id. */
  messageId: string;
  /** RFC 5322 Message-ID header we stamped on the message (for threading). */
  internetMessageId: string;
  status: 'queued' | 'sent' | 'failed';
  error?: string;
}

export const InboundEmailSchema = z.object({
  /** Provider id (Resend email_id, Gmail message id, …). */
  providerMessageId: z.string().min(1),
  /** RFC 5322 Message-ID header, if known. */
  internetMessageId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).default([]),
  from: z.string().min(3),
  fromName: z.string().optional(),
  to: z.array(z.string()).default([]),
  cc: z.array(z.string()).default([]),
  subject: z.string().default('(no subject)'),
  text: z.string().default(''),
  html: z.string().optional(),
  headers: z.record(z.string()).default({}),
  receivedAt: z.string().optional(),
  provider: z.string().default('generic'),
});

export type InboundEmail = z.infer<typeof InboundEmailSchema>;

export interface EmailConnector {
  readonly provider: string;
  /** The OS mailbox all mail is sent from and replied to. */
  readonly mailbox: EmailAddress;
  send(email: OutboundEmail): Promise<SendEmailResult>;
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

export function formatAddress(addr: EmailAddress): string {
  return addr.name ? `${addr.name} <${addr.email}>` : addr.email;
}

/** Extract the bare, lower-cased address from `"Name <a@b.com>"` or `a@b.com`. */
export function parseAddress(raw: string): EmailAddress {
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1]?.trim();
    const email = (match[2] ?? '').trim().toLowerCase();
    return name ? { email, name } : { email };
  }
  return { email: raw.trim().toLowerCase() };
}

export function generateInternetMessageId(domain: string): string {
  return `<${Date.now().toString(36)}.${randomBytes(12).toString('hex')}@${domain}>`;
}

function domainOf(email: string): string {
  return email.split('@')[1] ?? 'localhost';
}

// ─────────────────────────────────────────
// SIGNATURE VERIFICATION
// ─────────────────────────────────────────

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface HmacVerifyOptions {
  secret: string;
  body: string;
  signature: string;
  /** Unix seconds. When provided, the signed content is `${timestamp}.${body}`. */
  timestamp?: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}

/**
 * Verify a Hutchrok HMAC-SHA256 signature (`sha256=<hex>`).
 * Used for hutchrok.com site signals and the Gmail/Apps Script forwarder.
 */
export function verifyHmacSignature(opts: HmacVerifyOptions): boolean {
  if (!opts.secret || !opts.signature) return false;

  let signed = opts.body;
  if (opts.timestamp !== undefined) {
    const ts = Number(opts.timestamp);
    if (!Number.isFinite(ts)) return false;
    const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > (opts.toleranceSeconds ?? 300)) return false;
    signed = `${opts.timestamp}.${opts.body}`;
  }

  const expected = createHmac('sha256', opts.secret).update(signed).digest();
  const provided = Buffer.from(opts.signature.replace(/^sha256=/, ''), 'hex');
  return safeEqual(provided, expected);
}

export function signHmac(secret: string, body: string, timestamp?: string): string {
  const signed = timestamp !== undefined ? `${timestamp}.${body}` : body;
  return `sha256=${createHmac('sha256', secret).update(signed).digest('hex')}`;
}

export interface SvixVerifyOptions {
  /** Webhook signing secret, `whsec_<base64>`. */
  secret: string;
  body: string;
  svixId: string;
  svixTimestamp: string;
  /** Space-delimited list: `v1,<base64> v1,<base64>`. */
  svixSignature: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}

/** Verify a Svix-signed webhook (used by Resend). */
export function verifySvixSignature(opts: SvixVerifyOptions): boolean {
  if (!opts.secret || !opts.svixId || !opts.svixTimestamp || !opts.svixSignature) return false;

  const ts = Number(opts.svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > (opts.toleranceSeconds ?? 300)) return false;

  const key = Buffer.from(opts.secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key)
    .update(`${opts.svixId}.${opts.svixTimestamp}.${opts.body}`)
    .digest();

  return opts.svixSignature.split(' ').some((part) => {
    const [version, sig] = part.split(',');
    if (version !== 'v1' || !sig) return false;
    return safeEqual(Buffer.from(sig, 'base64'), expected);
  });
}

// ─────────────────────────────────────────
// RESEND INBOUND PARSING
// ─────────────────────────────────────────

const ResendInboundWebhookSchema = z.object({
  type: z.string(),
  created_at: z.string().optional(),
  data: z
    .object({
      email_id: z.string().optional(),
      id: z.string().optional(),
      message_id: z.string().optional(),
      from: z.string(),
      to: z.array(z.string()).default([]),
      cc: z.array(z.string()).default([]),
      subject: z.string().default('(no subject)'),
      text: z.string().optional(),
      html: z.string().optional(),
      headers: z
        .union([
          z.record(z.string()),
          z.array(z.object({ name: z.string(), value: z.string() })),
        ])
        .optional(),
      created_at: z.string().optional(),
    })
    .passthrough(),
});

function normalizeHeaders(
  headers: Record<string, string> | Array<{ name: string; value: string }> | undefined,
): Record<string, string> {
  if (!headers) return {};
  const entries = Array.isArray(headers) ? headers.map((h) => [h.name, h.value] as const) : Object.entries(headers);
  return Object.fromEntries(entries.map(([k, v]) => [k.toLowerCase(), v]));
}

export function splitReferences(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * Normalize a Resend `email.received` webhook into an InboundEmail.
 * Returns null for non-inbound event types (delivery/bounce events etc.).
 * When the webhook omits the body, the caller should hydrate it with
 * `ResendEmailConnector.fetchReceived()`.
 */
export function parseResendInbound(payload: unknown): InboundEmail | null {
  const parsed = ResendInboundWebhookSchema.safeParse(payload);
  if (!parsed.success || parsed.data.type !== 'email.received') return null;

  const d = parsed.data.data;
  const headers = normalizeHeaders(d.headers);
  const from = parseAddress(d.from);

  return InboundEmailSchema.parse({
    providerMessageId: d.email_id ?? d.id ?? d.message_id ?? headers['message-id'] ?? '',
    internetMessageId: d.message_id ?? headers['message-id'],
    inReplyTo: headers['in-reply-to'],
    references: splitReferences(headers['references']),
    from: from.email,
    fromName: from.name,
    to: d.to.map((t) => parseAddress(t).email),
    cc: d.cc.map((t) => parseAddress(t).email),
    subject: d.subject,
    text: d.text ?? '',
    html: d.html,
    headers,
    receivedAt: d.created_at ?? parsed.data.created_at,
    provider: 'resend',
  });
}

// ─────────────────────────────────────────
// RESEND OUTBOUND ADAPTER
// ─────────────────────────────────────────

export interface ResendConnectorOptions {
  apiKey: string;
  mailbox: EmailAddress;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class ResendEmailConnector implements EmailConnector {
  readonly provider = 'resend';
  readonly mailbox: EmailAddress;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ResendConnectorOptions) {
    this.apiKey = opts.apiKey;
    this.mailbox = opts.mailbox;
    this.baseUrl = opts.baseUrl ?? 'https://api.resend.com';
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async send(email: OutboundEmail): Promise<SendEmailResult> {
    const internetMessageId = generateInternetMessageId(domainOf(this.mailbox.email));
    const headers: Record<string, string> = { 'Message-ID': internetMessageId, ...email.headers };
    if (email.inReplyTo) headers['In-Reply-To'] = email.inReplyTo;
    if (email.references?.length) headers['References'] = email.references.join(' ');

    const body: Record<string, unknown> = {
      from: email.from ?? formatAddress(this.mailbox),
      to: email.to,
      subject: email.subject,
      text: email.text,
      reply_to: email.replyTo ?? this.mailbox.email,
      headers,
    };
    if (email.html) body['html'] = email.html;
    if (email.cc?.length) body['cc'] = email.cc;
    if (email.tags) body['tags'] = Object.entries(email.tags).map(([name, value]) => ({ name, value }));

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        return { messageId: '', internetMessageId, status: 'failed', error: `Resend HTTP ${res.status}` };
      }
      const json = (await res.json()) as { id?: string };
      return { messageId: json.id ?? '', internetMessageId, status: 'sent' };
    } catch (e) {
      return { messageId: '', internetMessageId, status: 'failed', error: (e as Error).message };
    }
  }

  /** Fetch the full body of a received email when the webhook omitted it. */
  async fetchReceived(emailId: string): Promise<{ text?: string; html?: string; headers?: Record<string, string> } | null> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/emails/receiving/${encodeURIComponent(emailId)}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        text?: string;
        html?: string;
        headers?: Record<string, string> | Array<{ name: string; value: string }>;
      };
      const out: { text?: string; html?: string; headers?: Record<string, string> } = {
        headers: normalizeHeaders(json.headers),
      };
      if (json.text !== undefined) out.text = json.text;
      if (json.html !== undefined) out.html = json.html;
      return out;
    } catch {
      return null;
    }
  }
}

// ─────────────────────────────────────────
// MOCK ADAPTER
// ─────────────────────────────────────────

export class MockEmailConnector implements EmailConnector {
  readonly provider = 'mock';
  readonly sent: Array<OutboundEmail & { result: SendEmailResult }> = [];

  constructor(readonly mailbox: EmailAddress) {}

  async send(email: OutboundEmail): Promise<SendEmailResult> {
    const result: SendEmailResult = {
      messageId: `mock_email_${this.sent.length + 1}`,
      internetMessageId: generateInternetMessageId(domainOf(this.mailbox.email)),
      status: 'sent',
    };
    this.sent.push({ ...email, result });
    return result;
  }
}
