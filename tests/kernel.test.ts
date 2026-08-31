/**
 * Tests: Kernel Loader
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Company Kernel', () => {
  beforeEach(async () => {
    // Re-import to get a fresh module state
    const { loadKernel } = await import('../packages/kernel/src/index.js');
    const { hutchrokKernel } = await import('../config/business/hutchrok.kernel.js');
    loadKernel(hutchrokKernel);
  });

  it('loads and validates the Hutchrok kernel', async () => {
    const { getKernel } = await import('../packages/kernel/src/index.js');
    const kernel = getKernel();

    expect(kernel.identity.businessId).toBe('hutchrok-solutions-group');
    expect(kernel.identity.legalName).toBe('Hutchrok Solutions Group LLC');
    expect(kernel.identity.owner).toBe('Alfreddie Postell II');
  });

  it('has all required approval levels', async () => {
    const { getKernel } = await import('../packages/kernel/src/index.js');
    const kernel = getKernel();

    expect(kernel.approvalThresholds.levelA.requiresHuman).toBe(false);
    expect(kernel.approvalThresholds.levelB.requiresHuman).toBe(false);
    expect(kernel.approvalThresholds.levelC.requiresHuman).toBe(true);
    expect(kernel.approvalThresholds.levelD.requiresHuman).toBe(true);
    expect(kernel.approvalThresholds.levelD.roles).toContain('OWNER');
  });

  it('prohibits RESTRICTED and SECRET data from AI models', async () => {
    const { getKernel } = await import('../packages/kernel/src/index.js');
    const kernel = getKernel();

    expect(kernel.aiPermissions.prohibitedClassifications).toContain('RESTRICTED');
    expect(kernel.aiPermissions.prohibitedClassifications).toContain('SECRET');
  });

  it('does not store secrets inline', async () => {
    const { getKernel } = await import('../packages/kernel/src/index.js');
    const kernel = getKernel();

    // EIN must be an envRef, never an inline value
    expect(kernel.identity.ein).toHaveProperty('envRef');
    expect(kernel.identity.ein).not.toHaveProperty('value');
  });

  it('has all required divisions', async () => {
    const { getKernel } = await import('../packages/kernel/src/index.js');
    const kernel = getKernel();

    const divisionIds = kernel.divisions.map((d) => d.id);
    expect(divisionIds).toContain('veteran-services');
    expect(divisionIds).toContain('technology');
    expect(divisionIds).toContain('govcon');
    expect(divisionIds).toContain('marketing');
  });
});
