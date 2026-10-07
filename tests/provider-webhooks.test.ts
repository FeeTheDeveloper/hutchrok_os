/**
 * Provider webhook boundary — signature, replay, and explicit-unsupported state.
 *
 * Covers Section 16 "Security: webhook signature/replay" and the Section 15
 * criterion that every delivery resolves to a typed workflow or an explicit
 * unsupported/exception state — never a silent success.
 */

import { createHmac } from 'crypto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const STRIPE_SECRET = 'whsec_test_stripe';
const GITHUB_SECRET = 'ghsecret_test';

// Secrets must be set before the router module reads them at request time.
const ORIGINAL_ENV = { ...process.env };

function stripeSignature(body: string, secret: string, timestamp: number): string {
  const mac = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${mac}`;
}

function githubSignature(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('provider webhooks', () => {
  let webhooksRouter: import('hono').Hono;
  let exceptions: typeof import('../apps/api/src/activity.js')['exceptions'];

  beforeEach(async () => {
    process.env['STRIPE_WEBHOOK_SECRET'] = STRIPE_SECRET;
    process.env['GITHUB_WEBHOOK_SECRET'] = GITHUB_SECRET;
    delete process.env['GOOGLE_WEBHOOK_SECRET'];
    delete process.env['COMMUNICATIONS_WEBHOOK_SECRET'];

    // The router and its in-memory stores are module-level singletons, so
    // each test below uses its own provider event ids rather than resetting.
    const activity = await import('../apps/api/src/activity.js');
    const mod = await import('../apps/api/src/webhooks/index.js');
    webhooksRouter = mod.webhooksRouter;
    exceptions = activity.exceptions;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('refuses a delivery it cannot verify when the secret is unconfigured', async () => {
    const res = await webhooksRouter.request('/google-workspace', {
      method: 'POST',
      body: JSON.stringify({ messageId: 'm1' }),
    });

    expect(res.status).toBe(503);
    const body = (await res.json()) as { configured: boolean };
    expect(body.configured).toBe(false);
  });

  it('rejects a bad Stripe signature', async () => {
    const body = JSON.stringify({ id: 'evt_bad' });
    const res = await webhooksRouter.request('/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=deadbeef' },
      body,
    });

    expect(res.status).toBe(401);
  });

  it('rejects a Stripe delivery with no signature header at all', async () => {
    const res = await webhooksRouter.request('/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_nosig' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects a correctly-signed Stripe delivery that is outside the replay window', async () => {
    const body = JSON.stringify({ id: 'evt_stale' });
    const stale = Math.floor(Date.now() / 1000) - 60 * 60; // an hour old
    const res = await webhooksRouter.request('/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': stripeSignature(body, STRIPE_SECRET, stale) },
      body,
    });

    expect(res.status).toBe(401);
  });

  it('accepts a valid Stripe delivery once, then reports every repeat as a replay', async () => {
    const body = JSON.stringify({ id: 'evt_replay_test' });
    const ts = Math.floor(Date.now() / 1000);
    const headers = { 'stripe-signature': stripeSignature(body, STRIPE_SECRET, ts) };

    const first = await webhooksRouter.request('/stripe', { method: 'POST', headers, body });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as {
      replay: boolean;
      handled: boolean;
      receiptId: string;
      exceptionId: string;
    };
    expect(firstBody.replay).toBe(false);
    expect(firstBody.handled).toBe(false);
    expect(firstBody.receiptId).toBeTruthy();
    expect(firstBody.exceptionId).toBeTruthy();

    const second = await webhooksRouter.request('/stripe', { method: 'POST', headers, body });
    // 200 so the provider stops retrying...
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { replay: boolean; replayCount: number };
    // ...but it is recorded as a replay and nothing ran again.
    expect(secondBody.replay).toBe(true);
    expect(secondBody.replayCount).toBe(1);

    const third = await webhooksRouter.request('/stripe', { method: 'POST', headers, body });
    const thirdBody = (await third.json()) as { replay: boolean; replayCount: number };
    expect(thirdBody.replay).toBe(true);
    expect(thirdBody.replayCount).toBe(2);
  });

  it('raises exactly one exception for a delivery with no handler', async () => {
    const before = (await exceptions.list({ reason: 'UNSUPPORTED_REQUEST' })).length;

    const body = JSON.stringify({ id: 'evt_once' });
    const ts = Math.floor(Date.now() / 1000);
    const headers = { 'stripe-signature': stripeSignature(body, STRIPE_SECRET, ts) };

    await webhooksRouter.request('/stripe', { method: 'POST', headers, body });
    await webhooksRouter.request('/stripe', { method: 'POST', headers, body });
    await webhooksRouter.request('/stripe', { method: 'POST', headers, body });

    const after = await exceptions.list({ reason: 'UNSUPPORTED_REQUEST' });
    // Three deliveries, one exception — the replays did not re-raise.
    expect(after.length).toBe(before + 1);
    expect(after.at(-1)?.status).toBe('OPEN');
    expect(after.at(-1)?.ownerRole).toBe('Owner');
  });

  it('rejects a delivery that carries no provider event id', async () => {
    const body = JSON.stringify({ not_an_id: true });
    const ts = Math.floor(Date.now() / 1000);
    const res = await webhooksRouter.request('/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': stripeSignature(body, STRIPE_SECRET, ts) },
      body,
    });

    expect(res.status).toBe(400);
    const parsed = (await res.json()) as { error: string };
    expect(parsed.error).toMatch(/idempotency/i);
  });

  it('verifies a GitHub delivery by its own signature scheme and delivery id', async () => {
    const body = JSON.stringify({ action: 'opened' });

    const unsigned = await webhooksRouter.request('/github', { method: 'POST', body });
    expect(unsigned.status).toBe(401);

    const signed = await webhooksRouter.request('/github', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': githubSignature(body, GITHUB_SECRET),
        'x-github-delivery': 'delivery-abc',
      },
      body,
    });
    expect(signed.status).toBe(200);
    const parsed = (await signed.json()) as { replay: boolean; handled: boolean };
    expect(parsed.replay).toBe(false);
    expect(parsed.handled).toBe(false);
  });

  it('keeps providers in separate idempotency namespaces', async () => {
    const sharedId = 'collision-id';

    const stripeBody = JSON.stringify({ id: sharedId });
    const ts = Math.floor(Date.now() / 1000);
    const stripeRes = await webhooksRouter.request('/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': stripeSignature(stripeBody, STRIPE_SECRET, ts) },
      body: stripeBody,
    });
    expect(((await stripeRes.json()) as { replay: boolean }).replay).toBe(false);

    const ghBody = JSON.stringify({ action: 'opened' });
    const ghRes = await webhooksRouter.request('/github', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': githubSignature(ghBody, GITHUB_SECRET),
        'x-github-delivery': sharedId,
      },
      body: ghBody,
    });
    // Same id, different provider — still a first sighting.
    expect(((await ghRes.json()) as { replay: boolean }).replay).toBe(false);
  });
});
