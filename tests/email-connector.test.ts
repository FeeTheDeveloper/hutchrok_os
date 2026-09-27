/**
 * Tests: Email connector — signatures, Resend inbound parsing, outbound send
 */

import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import {
  ResendEmailConnector,
  parseAddress,
  parseResendInbound,
  signHmac,
  verifyHmacSignature,
  verifySvixSignature,
} from '../packages/connectors/src/index.js';

describe('HMAC signatures (site signals / Gmail forwarder)', () => {
  const secret = 'test-secret';
  const body = JSON.stringify({ hello: 'world' });

  it('accepts a valid timestamped signature', () => {
    const ts = '1790000000';
    const signature = signHmac(secret, body, ts);
    expect(verifyHmacSignature({ secret, body, signature, timestamp: ts, nowSeconds: 1790000010 })).toBe(true);
  });

  it('rejects stale timestamps (replay protection)', () => {
    const ts = '1790000000';
    const signature = signHmac(secret, body, ts);
    expect(verifyHmacSignature({ secret, body, signature, timestamp: ts, nowSeconds: 1790001000 })).toBe(false);
  });

  it('rejects tampered bodies and missing secrets', () => {
    const signature = signHmac(secret, body);
    expect(verifyHmacSignature({ secret, body: body + ' ', signature })).toBe(false);
    expect(verifyHmacSignature({ secret: '', body, signature })).toBe(false);
  });
});

describe('Svix signatures (Resend webhooks)', () => {
  const key = Buffer.from('resend-signing-key-bytes');
  const secret = `whsec_${key.toString('base64')}`;
  const body = '{"type":"email.received"}';
  const svixId = 'msg_123';
  const svixTimestamp = '1790000000';
  const sig = createHmac('sha256', key).update(`${svixId}.${svixTimestamp}.${body}`).digest('base64');

  it('accepts a valid v1 signature among several', () => {
    expect(
      verifySvixSignature({ secret, body, svixId, svixTimestamp, svixSignature: `v1,bogus v1,${sig}`, nowSeconds: 1790000001 }),
    ).toBe(true);
  });

  it('rejects an invalid signature', () => {
    expect(
      verifySvixSignature({ secret, body: '{}', svixId, svixTimestamp, svixSignature: `v1,${sig}`, nowSeconds: 1790000001 }),
    ).toBe(false);
  });
});

describe('Resend inbound parsing', () => {
  it('normalizes an email.received webhook', () => {
    const email = parseResendInbound({
      type: 'email.received',
      created_at: '2026-09-28T15:00:00Z',
      data: {
        email_id: 're_abc',
        from: 'Jordan Client <Jordan@Example.com>',
        to: ['repo_addy@hutchrok.com'],
        subject: 'Re: Welcome [Ref HRK-1A2B3C4D]',
        text: 'Thanks',
        headers: [
          { name: 'Message-ID', value: '<m2@example.com>' },
          { name: 'In-Reply-To', value: '<m1@hutchrok.com>' },
          { name: 'References', value: '<m0@hutchrok.com> <m1@hutchrok.com>' },
        ],
      },
    });
    expect(email?.from).toBe('jordan@example.com');
    expect(email?.fromName).toBe('Jordan Client');
    expect(email?.inReplyTo).toBe('<m1@hutchrok.com>');
    expect(email?.references).toEqual(['<m0@hutchrok.com>', '<m1@hutchrok.com>']);
    expect(email?.provider).toBe('resend');
  });

  it('ignores non-inbound events', () => {
    expect(parseResendInbound({ type: 'email.delivered', data: { from: 'a@b.com' } })).toBeNull();
  });

  it('parses bare and named addresses', () => {
    expect(parseAddress('a@B.com')).toEqual({ email: 'a@b.com' });
    expect(parseAddress('"Name" <a@b.com>')).toEqual({ email: 'a@b.com', name: 'Name' });
  });
});

describe('ResendEmailConnector', () => {
  it('sends from the OS mailbox with reply-to and threading headers', async () => {
    let captured: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init: { body: string }) => {
      captured = JSON.parse(init.body) as Record<string, unknown>;
      return new Response(JSON.stringify({ id: 'resend_1' }), { status: 200 });
    }) as unknown as typeof fetch;

    const connector = new ResendEmailConnector({
      apiKey: 're_test',
      mailbox: { email: 'repo_addy@hutchrok.com', name: 'Hutchrok Solutions Group' },
      fetchImpl,
    });
    const result = await connector.send({ to: ['c@example.com'], subject: 'Hi', text: 'Body', inReplyTo: '<m1@example.com>' });

    expect(result.status).toBe('sent');
    expect(result.messageId).toBe('resend_1');
    expect(captured['from']).toBe('Hutchrok Solutions Group <repo_addy@hutchrok.com>');
    expect(captured['reply_to']).toBe('repo_addy@hutchrok.com');
    const headers = captured['headers'] as Record<string, string>;
    expect(headers['In-Reply-To']).toBe('<m1@example.com>');
    expect(headers['Message-ID']).toBe(result.internetMessageId);
  });

  it('reports provider failures without throwing', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 422 })) as unknown as typeof fetch;
    const connector = new ResendEmailConnector({ apiKey: 'x', mailbox: { email: 'repo_addy@hutchrok.com' }, fetchImpl });
    const result = await connector.send({ to: ['c@example.com'], subject: 'Hi', text: 'Body' });
    expect(result.status).toBe('failed');
  });
});
