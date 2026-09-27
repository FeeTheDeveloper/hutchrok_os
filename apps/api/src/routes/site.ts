/**
 * hutchrok.com → Hutchrok OS signal ingestion
 *
 * POST /api/v1/site/signals
 *   Headers: x-hutchrok-timestamp: <unix seconds>
 *            x-hutchrok-signature: sha256=<hex HMAC of "<timestamp>.<raw body>">
 *   Body:    SiteSignal (packages/autopilot/src/signals.ts)
 *
 * Every business action on the site (contact, lead, intake, service request,
 * case lifecycle, payments) arrives here and is run by the autopilot.
 */

import { Hono } from 'hono';
import { verifyHmacSignature } from '@hutchrok-os/connectors';
import { SiteSignalSchema, threadRef } from '@hutchrok-os/autopilot';
import { autopilot } from '../autopilot.js';
import { rateLimit } from '../middleware/security.js';

export const siteRouter = new Hono();

siteRouter.post('/signals', rateLimit({ prefix: 'site-signals', limit: 120, windowMs: 60_000 }), async (c) => {
  const secret = process.env['WEBSITE_INGESTION_SECRET'];
  if (!secret) return c.json({ error: 'Site ingestion is not configured' }, 503);

  const rawBody = await c.req.text();
  const valid = verifyHmacSignature({
    secret,
    body: rawBody,
    signature: c.req.header('x-hutchrok-signature') ?? '',
    timestamp: c.req.header('x-hutchrok-timestamp') ?? '',
  });
  if (!valid) return c.json({ error: 'Invalid signature' }, 401);

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const parsed = SiteSignalSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid signal', details: parsed.error.issues }, 400);

  const run = await autopilot.handleSiteSignal(parsed.data);
  return c.json(
    {
      runId: run.runId,
      duplicate: run.duplicate,
      eventId: run.eventId,
      threadRef: run.threadId ? threadRef(run.threadId) : undefined,
      actions: run.actions.map((a) => ({ kind: a.kind, status: a.status })),
    },
    run.duplicate ? 200 : 202,
  );
});
