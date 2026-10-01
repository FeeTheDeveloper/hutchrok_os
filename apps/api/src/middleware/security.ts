/**
 * API security middleware — rate limiting and operator bearer auth.
 */

import { timingSafeEqual } from 'crypto';
import { createHash } from 'crypto';
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

export interface ApproverIdentity {
  userId: string;
  maxLevel: 'C' | 'D';
}

/**
 * A separate, individual credential is required to resolve a human approval.
 * AUTOPILOT_APPROVERS_JSON contains [{"userId":"...","keySha256":"64 hex chars","maxLevel":"C|D"}].
 * Store only key hashes in configuration; the key itself is supplied in a request header.
 */
export function identifyApprover(key: string | undefined, configured = process.env['AUTOPILOT_APPROVERS_JSON']): ApproverIdentity | null {
  if (!key || !configured) return null;
  let entries: unknown;
  try {
    entries = JSON.parse(configured);
  } catch {
    return null;
  }
  if (!Array.isArray(entries)) return null;
  const suppliedHash = createHash('sha256').update(key).digest();
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate['userId'] !== 'string' || !candidate['userId'] ||
        (candidate['maxLevel'] !== 'C' && candidate['maxLevel'] !== 'D') ||
        typeof candidate['keySha256'] !== 'string' || !/^[a-f0-9]{64}$/i.test(candidate['keySha256'])) continue;
    const expected = Buffer.from(candidate['keySha256'], 'hex');
    if (timingSafeEqual(suppliedHash, expected)) {
      return { userId: candidate['userId'], maxLevel: candidate['maxLevel'] };
    }
  }
  return null;
}
