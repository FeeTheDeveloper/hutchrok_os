import { describe, expect, it } from 'vitest';
import {
  attentionItems,
  buildConnectionReadiness,
  buildControlStages,
  businessIdentity,
  domainReadiness,
  readinessSummary,
  recoveryItems,
} from '../apps/command-center/src/lib/control-panel';

describe('command center control model', () => {
  it('keeps production blocked while durable recovery is incomplete', () => {
    const controlStages = buildControlStages({});
    expect(readinessSummary.productionBlocked).toBe(true);
    expect(recoveryItems.some((item) => item.status === 'blocked')).toBe(true);
    expect(controlStages.at(-1)).toMatchObject({ name: 'Audit', status: 'blocked' });
  });

  it('marks implemented repository controls separately from live connectors', () => {
    expect(domainReadiness).toHaveLength(5);
    expect(domainReadiness).toContainEqual({ name: 'Durable adapters', status: 'ready' });
    expect(domainReadiness).toContainEqual({ name: 'Provider effects', status: 'unavailable' });
  });

  it('does not treat a kernel flag or credential presence as a live connection', () => {
    const empty = buildConnectionReadiness({});
    expect(empty).toHaveLength(9);
    expect(empty.some((item) => item.configuredInKernel)).toBe(true);
    expect(empty.every((item) => item.status === 'unavailable')).toBe(true);

    const configured = buildConnectionReadiness({
      DATABASE_URL: 'postgresql://local/example',
      WEBSITE_INGESTION_SECRET: 'present-but-not-shown',
    });
    expect(configured.find((item) => item.id === 'database')?.status).toBe('guarded');
    expect(configured.find((item) => item.id === 'site-bridge')?.status).toBe('guarded');
    expect(configured.every((item) => item.status !== 'ready')).toBe(true);
  });

  it('surfaces the material FTD-CORE-001 review findings', () => {
    expect(attentionItems.map((item) => item.area)).toEqual(
      expect.arrayContaining(['Approval', 'Isolation', 'Recovery']),
    );
  });

  it('keeps the public contact identity cohesive without claiming registered-agent authority', () => {
    expect(businessIdentity.publicEmail).toBe('contact@hutchrok.com');
    expect(businessIdentity.publicAddress).toBe('990 S State Hwy 5 (TX-5), Fairview, TX 75069');
    expect(businessIdentity.timezone).toBe('America/Chicago');
  });
});
