/**
 * Website Event Ingestion Endpoint
 *
 * Accepts signed event payloads from hutchrok.com.
 * Validates HMAC signature before processing.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
import { createEvent } from '@hutchrok-os/events';
import { generateCorrelationId } from '@hutchrok-os/shared';

export const eventsRouter = new Hono();

const WebsiteEventSchema = z.object({
  eventType: z.string(),
  sessionId: z.string().optional(),
  page: z.string().optional(),
  referrer: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
  timestamp: z.string().optional(),
  signature: z.string().optional(),
});

function verifySignature(body: string, signature: string): boolean {
  const secret = process.env['WEBSITE_INGESTION_SECRET'];
  if (!secret) return false;

  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const sigBuffer = Buffer.from(signature.replace('sha256=', ''), 'hex');
  const expBuffer = Buffer.from(expected, 'hex');

  if (sigBuffer.length !== expBuffer.length) return false;
  return timingSafeEqual(sigBuffer, expBuffer);
}

eventsRouter.post('/website', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('x-hutchrok-signature') ?? '';

  // Verify signature in production
  if (process.env['APP_ENV'] === 'production' || process.env['APP_ENV'] === 'staging') {
    if (!verifySignature(rawBody, signature)) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  const parsed = WebsiteEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid event payload', details: parsed.error.issues }, 400);
  }

  const event = createEvent({
    event_type: parsed.data.eventType,
    source: 'website',
    actor: parsed.data.sessionId ?? 'anonymous',
    payload: {
      ...parsed.data.payload,
      page: parsed.data.page,
      referrer: parsed.data.referrer,
      sessionId: parsed.data.sessionId,
    },
    correlation_id: generateCorrelationId(),
    risk_level: 'LOW',
  });

  // TODO: Persist and process event through pipeline
  console.log('[Website Event]', event.event_type, event.event_id);

  return c.json({ eventId: event.event_id }, 201);
});
