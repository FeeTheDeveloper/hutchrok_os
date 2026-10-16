/**
 * Tests: GovCon connector — SAM.gov query building, normalization, failure handling, MCP wiring
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  SamGovOpportunitiesConnector,
  UnconfiguredGovConConnector,
  buildSamQuery,
  createGovConConnectorFromEnv,
  normalizeSamOpportunity,
} from '../packages/connectors/src/index.js';
import { MCPToolRegistry, govconSearchOpportunities, setGovConConnector } from '../packages/mcp/src/index.js';

const NOW = new Date('2026-10-16T12:00:00Z');
const KEY = 'test-sam-key-not-real';

// Synthetic fixture shaped like a SAM v2 opportunitiesData record. Not a real notice.
const FIXTURE = {
  noticeId: 'fixture-notice-0001',
  title: 'FIXTURE — Janitorial Services',
  solicitationNumber: 'FIXTURE-26-Q-0001',
  fullParentPathName: 'DEPT OF FIXTURES.FIXTURE COMMAND.FIXTURE OFFICE',
  postedDate: '2026-10-10',
  type: 'Combined Synopsis/Solicitation',
  baseType: 'Combined Synopsis/Solicitation',
  typeOfSetAside: 'SDVOSBC',
  typeOfSetAsideDescription: 'Service-Disabled Veteran-Owned Small Business (SDVOSB) Set-Aside (FAR 19.14)',
  responseDeadLine: '2026-11-01T14:00:00-05:00',
  naicsCode: '561720',
  classificationCode: 'S201',
  active: 'Yes',
  pointOfContact: [
    {
      type: 'primary',
      fullName: 'Fixture Contact',
      email: 'contact@example.invalid',
      phone: '000-000-0000',
    },
  ],
  placeOfPerformance: {
    city: { name: 'Austin' },
    state: { code: 'TX' },
    zip: '78701',
    country: { code: 'USA' },
  },
  description: 'https://api.sam.gov/prod/opportunities/v1/noticedesc?noticeid=fixture-notice-0001',
  uiLink: 'https://sam.gov/opp/fixture-notice-0001/view',
  resourceLinks: ['https://example.invalid/a.pdf', 'https://example.invalid/b.pdf'],
};

function fakeFetch(handler: (url: URL) => Response): {
  fetchImpl: typeof fetch;
  calls: URL[];
} {
  const calls: URL[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    calls.push(url);
    return handler(url);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('buildSamQuery', () => {
  it('defaults to a 30-day posted window in SAM date format', () => {
    const q = buildSamQuery({}, NOW);
    expect(q.postedFrom).toBe('09/16/2026');
    expect(q.postedTo).toBe('10/16/2026');
    expect(q.limit).toBe('25');
  });

  it('maps filters to SAM parameter names', () => {
    const q = buildSamQuery(
      {
        keywords: 'janitorial',
        naicsCode: '561720',
        pscCode: 'S201',
        setAside: 'sdvosbc',
        noticeTypes: ['o', 'k'],
        state: 'tx',
        responseDeadlineFrom: '2026-10-16',
      },
      NOW,
    );
    expect(q).toMatchObject({
      title: 'janitorial',
      ncode: '561720',
      ccode: 'S201',
      typeOfSetAside: 'SDVOSBC',
      ptype: 'o,k',
      state: 'TX',
      rdlfrom: '10/16/2026',
      rdlto: '10/16/2027',
    });
  });

  it('rejects windows over one year and inverted ranges', () => {
    expect(() => buildSamQuery({ postedFrom: '2025-01-01', postedTo: '2026-10-16' }, NOW)).toThrow(/one year/);
    expect(() => buildSamQuery({ postedFrom: '2026-10-16', postedTo: '2026-10-01' }, NOW)).toThrow(/on or before/);
  });
});

describe('normalizeSamOpportunity', () => {
  it('keeps provenance fields and splits agency/office', () => {
    const o = normalizeSamOpportunity(FIXTURE);
    expect(o).toMatchObject({
      source: 'sam.gov',
      noticeId: 'fixture-notice-0001',
      agency: 'DEPT OF FIXTURES',
      office: 'FIXTURE OFFICE',
      setAside: 'SDVOSBC',
      responseDeadline: '2026-11-01T14:00:00-05:00',
      naicsCode: '561720',
      pscCode: 'S201',
      active: true,
      attachmentCount: 2,
      placeOfPerformance: {
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        country: 'USA',
      },
    });
  });

  it('leaves missing fields undefined instead of inventing them', () => {
    const o = normalizeSamOpportunity({ noticeId: 'x' });
    expect(o.agency).toBeUndefined();
    expect(o.responseDeadline).toBeUndefined();
    expect(o.attachmentCount).toBe(0);
    expect(o.url).toBe('https://sam.gov/opp/x/view');
  });
});

describe('SamGovOpportunitiesConnector', () => {
  it('calls the v2 endpoint with the key and returns normalized results', async () => {
    const { fetchImpl, calls } = fakeFetch(() => Response.json({ totalRecords: 1, opportunitiesData: [FIXTURE] }));
    const c = new SamGovOpportunitiesConnector({
      apiKey: KEY,
      fetchImpl,
      now: () => NOW,
    });
    const r = await c.searchOpportunities({ setAside: 'SDVOSBC' });

    expect(calls[0].origin + calls[0].pathname).toBe('https://api.sam.gov/opportunities/v2/search');
    expect(calls[0].searchParams.get('api_key')).toBe(KEY);
    expect(r.status).toBe('OK');
    expect(r.retrievedAt).toBe(NOW.toISOString());
    expect(r.totalRecords).toBe(1);
    expect(r.opportunities[0].noticeId).toBe('fixture-notice-0001');
    expect(JSON.stringify(r.query)).not.toContain(KEY);
  });

  it('reports HTTP errors without leaking the key', async () => {
    const { fetchImpl } = fakeFetch(() => new Response(`bad key ${KEY}`, { status: 403 }));
    const r = await new SamGovOpportunitiesConnector({
      apiKey: KEY,
      fetchImpl,
      now: () => NOW,
    }).searchOpportunities({});
    expect(r.status).toBe('ERROR');
    expect(r.error).toContain('403');
    expect(JSON.stringify(r)).not.toContain(KEY);
    expect(r.opportunities).toEqual([]);
  });

  it('reports network failures as ERROR', async () => {
    const fetchImpl = (async () => {
      throw new Error('CONNECT tunnel failed');
    }) as unknown as typeof fetch;
    const r = await new SamGovOpportunitiesConnector({
      apiKey: KEY,
      fetchImpl,
      now: () => NOW,
    }).searchOpportunities({});
    expect(r.status).toBe('ERROR');
    expect(r.error).toMatch(/tunnel/);
  });
});

describe('env selection', () => {
  it('returns NOT_CONFIGURED with no key and never fabricates data', async () => {
    const c = createGovConConnectorFromEnv({});
    expect(c).toBeInstanceOf(UnconfiguredGovConConnector);
    const r = await c.searchOpportunities({});
    expect(r.status).toBe('NOT_CONFIGURED');
    expect(r.opportunities).toEqual([]);
  });

  it('uses the SAM adapter when SAM_GOV_API_KEY is set', () => {
    expect(createGovConConnectorFromEnv({ SAM_GOV_API_KEY: KEY })).toBeInstanceOf(SamGovOpportunitiesConnector);
  });
});

describe('MCP govcon.search_opportunities', () => {
  afterEach(() => setGovConConnector(undefined));

  it('routes through the configured connector and tags tenant context', async () => {
    const { fetchImpl } = fakeFetch(() => Response.json({ totalRecords: 1, opportunitiesData: [FIXTURE] }));
    setGovConConnector(
      new SamGovOpportunitiesConnector({
        apiKey: KEY,
        fetchImpl,
        now: () => NOW,
      }),
    );
    const registry = new MCPToolRegistry();
    registry.register(govconSearchOpportunities);
    const ctx = {
      callerIdentity: 'test',
      callerRole: 'AI_AGENT',
      correlationId: 'corr-1',
      businessId: 'hutchrok',
    };
    const r = await registry.call('govcon.search_opportunities', { setAside: 'SDVOSBC', limit: 5 }, ctx);
    expect(r.status).toBe('OK');
    expect(r.businessId).toBe('hutchrok');
    expect(r.opportunities).toHaveLength(1);
  });

  it('caps MCP limit at 50', async () => {
    const registry = new MCPToolRegistry();
    registry.register(govconSearchOpportunities);
    const ctx = {
      callerIdentity: 'test',
      callerRole: 'AI_AGENT',
      correlationId: 'corr-2',
      businessId: 'hutchrok',
    };
    await expect(registry.call('govcon.search_opportunities', { limit: 51 }, ctx)).rejects.toThrow();
  });
});
