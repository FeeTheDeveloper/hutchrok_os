/**
 * API security middleware — rate limiting and operator bearer auth.
 */

import { timingSafeEqual } from 'crypto';
import type { MiddlewareHandler } from 'hono';

/** Fixed-window in-memory rate limiter keyed by client IP. */
export function rateLimit(opts: { limit: number; windowMs: number; prefix: string }): MiddlewareHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
    const key = `${opts.prefix}:${ip}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
    } else if (++entry.count > opts.limit) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json({ error: 'Too many requests' }, 429);
    }

    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    await next();
  };
}

/** Operator endpoints require `Authorization: Bearer $API_SECRET_KEY`. */
export const requireOperator: MiddlewareHandler = async (c, next) => {
  const secret = process.env['API_SECRET_KEY'];
  if (!secret) return c.json({ error: 'Operator API is not configured' }, 503);

  const provided = (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return c.json({ error: 'Unauthorized' }, 401);
  await next();
};
