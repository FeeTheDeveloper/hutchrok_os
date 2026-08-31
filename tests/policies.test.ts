/**
 * Tests: Policy Engine
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadKernel } from '../packages/kernel/src/index.js';
import { hutchrokKernel } from '../config/business/hutchrok.kernel.js';
import {
  evaluateDataAccessPolicy,
  evaluateActionPolicy,
  evaluateModelUsagePolicy,
} from '../packages/policies/src/index.js';

beforeAll(() => {
  loadKernel(hutchrokKernel);
});

describe('Policy Engine — Data Access', () => {
  it('allows agents to access INTERNAL data', () => {
    const result = evaluateDataAccessPolicy({
      actor: 'test-agent',
      actorRole: 'AI_AGENT',
      actorType: 'AGENT',
      dataClassification: 'INTERNAL',
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks agents from RESTRICTED data', () => {
    const result = evaluateDataAccessPolicy({
      actor: 'test-agent',
      actorRole: 'AI_AGENT',
      actorType: 'AGENT',
      dataClassification: 'RESTRICTED',
    });
    expect(result.allowed).toBe(false);
    expect(result.requiresRedaction).toBe(true);
  });

  it('blocks non-owner from SECRET data', () => {
    const result = evaluateDataAccessPolicy({
      actor: 'manager-user',
      actorRole: 'MANAGER',
      actorType: 'USER',
      dataClassification: 'SECRET',
    });
    expect(result.allowed).toBe(false);
  });

  it('allows owner to access RESTRICTED data', () => {
    const result = evaluateDataAccessPolicy({
      actor: 'alfreddie',
      actorRole: 'OWNER',
      actorType: 'USER',
      dataClassification: 'RESTRICTED',
    });
    expect(result.allowed).toBe(true);
  });
});

describe('Policy Engine — Action Authorization', () => {
  it('requires Level C for filing submission', () => {
    const result = evaluateActionPolicy({
      actorRole: 'AI_AGENT',
      actorType: 'AGENT',
      action: 'submit_filing',
      isFiling: true,
    });
    expect(result.requiresApproval).toBe(true);
    expect(result.approvalLevel).toBe('C');
  });

  it('requires Level C for production deployment', () => {
    const result = evaluateActionPolicy({
      actorRole: 'DEVELOPER',
      actorType: 'USER',
      action: 'deploy_production',
      isProductionDeployment: true,
    });
    expect(result.requiresApproval).toBe(true);
    expect(result.approvalLevel).toBe('C');
  });

  it('requires Level D for bank movement', () => {
    const result = evaluateActionPolicy({
      actorRole: 'MANAGER',
      actorType: 'USER',
      action: 'bank_movement',
    });
    expect(result.allowed).toBe(false);
    expect(result.approvalLevel).toBe('D');
  });
});

describe('Policy Engine — Model Usage', () => {
  it('blocks sending RESTRICTED data to AI', () => {
    const result = evaluateModelUsagePolicy({
      requestedCapability: 'generateText',
      dataClassification: 'RESTRICTED',
    });
    expect(result.allowed).toBe(false);
    expect(result.requiresRedaction).toBe(true);
  });

  it('requires redaction for CONFIDENTIAL data', () => {
    const result = evaluateModelUsagePolicy({
      requestedCapability: 'summarize',
      dataClassification: 'CONFIDENTIAL',
      sensitiveFields: ['ssn', 'ein'],
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresRedaction).toBe(true);
    expect(result.redactFields).toContain('ssn');
  });

  it('allows INTERNAL data with no redaction', () => {
    const result = evaluateModelUsagePolicy({
      requestedCapability: 'classify',
      dataClassification: 'INTERNAL',
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresRedaction).toBe(false);
  });
});
