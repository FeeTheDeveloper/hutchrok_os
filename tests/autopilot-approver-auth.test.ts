import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { identifyApprover } from '../apps/api/src/middleware/security.js';

describe('autopilot approver identity', () => {
  const key = 'one-individual-secret';
  const configured = JSON.stringify([{
    userId: 'operator-1',
    keySha256: createHash('sha256').update(key).digest('hex'),
    maxLevel: 'C',
  }]);

  it('derives identity and authority from the configured key', () => {
    expect(identifyApprover(key, configured)).toEqual({ userId: 'operator-1', maxLevel: 'C' });
    expect(identifyApprover('wrong-key', configured)).toBeNull();
  });

  it('fails closed for missing or malformed configuration', () => {
    expect(identifyApprover(key, undefined)).toBeNull();
    expect(identifyApprover(key, '{')).toBeNull();
    expect(identifyApprover(key, JSON.stringify([{ userId: 'operator-1', keySha256: 'bad', maxLevel: 'D' }]))).toBeNull();
  });
});
