import { describe, expect, it } from 'vitest';
import {
  attentionItems,
  controlStages,
  domainReadiness,
  readinessSummary,
  recoveryItems,
} from '../apps/command-center/src/lib/control-panel';

describe('command center control model', () => {
  it('keeps production blocked while durable recovery is incomplete', () => {
    expect(readinessSummary.productionBlocked).toBe(true);
    expect(recoveryItems.some((item) => item.status === 'blocked')).toBe(true);
    expect(controlStages.at(-1)).toMatchObject({ name: 'Audit', status: 'blocked' });
  });

  it('does not represent any external connector as ready', () => {
    expect(domainReadiness).toHaveLength(5);
    expect(domainReadiness.every((domain) => domain.status !== 'ready')).toBe(true);
  });

  it('surfaces the material FTD-CORE-001 review findings', () => {
    expect(attentionItems.map((item) => item.area)).toEqual(
      expect.arrayContaining(['Persistence', 'Delivery', 'Isolation']),
    );
  });
});
