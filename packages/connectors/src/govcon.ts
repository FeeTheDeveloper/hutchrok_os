/**
 * Hutchrok OS — GovCon Opportunity Connector
 *
 * Provider-neutral contract for federal contract-opportunity research.
 *
 * Adapters:
 * - SamGovOpportunitiesConnector — public SAM.gov Get Opportunities Public API v2
 *   (https://open.gsa.gov/api/get-opportunities-public-api/). Requires a SAM.gov
 *   public API key in SAM_GOV_API_KEY. Read-only: no login, no submissions.
 * - UnconfiguredGovConConnector  — returned when no key is set. Reports
 *   NOT_CONFIGURED and never fabricates opportunities.
 *
 * Results are research leads. A notice in the register is not eligibility,
 * an SDVOSB certification, or a bid decision (see hutchrok-sdvosb-contracting).
 */

import { z } from 'zod';

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

export const SAM_OPPORTUNITIES_ENDPOINT = 'https://api.sam.gov/opportunities/v2/search';

/** SAM procurement types (ptype). */
export const SAM_NOTICE_TYPES = {
  u: 'Justification (J&A)',
  p: 'Pre-solicitation',
  a: 'Award Notice',
  r: 'Sources Sought',
  s: 'Special Notice',
  o: 'Solicitation',
  g: 'Sale of Surplus Property',
  k: 'Combined Synopsis/Solicitation',
  i: 'Intent to Bundle Requirements (DoD-Funded)',
} as const;
export type SamNoticeTypeCode = keyof typeof SAM_NOTICE_TYPES;

export const OpportunitySearchSchema = z.object({
  /** Matched against the notice title (SAM v2 has no full-text keyword param). */
  keywords: z.string().trim().min(1).optional(),
  naicsCode: z
    .string()
    .regex(/^\d{2,6}$/)
    .optional(),
  /** Product/Service Code (classification code). */
  pscCode: z.string().trim().min(1).optional(),
  /** SAM set-aside code, e.g. SDVOSBC, SDVOSBS, VSA, SBA, 8A, WOSB, HZC. */
  setAside: z.string().trim().min(1).optional(),
  noticeTypes: z.array(z.enum(Object.keys(SAM_NOTICE_TYPES) as [SamNoticeTypeCode, ...SamNoticeTypeCode[]])).optional(),
  /** Two-letter place-of-performance state. */
  state: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
  /** ISO dates (YYYY-MM-DD). Default window: the last 30 days. SAM caps the window at 1 year. */
  postedFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  postedTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** Only notices whose response deadline is on/after this ISO date. */
  responseDeadlineFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.number().int().positive().max(1000).default(25),
  offset: z.number().int().nonnegative().default(0),
});
export type OpportunitySearch = z.input<typeof OpportunitySearchSchema>;

export interface ContractOpportunity {
  source: 'sam.gov';
  noticeId: string;
  title: string;
  solicitationNumber?: string | undefined;
  agency?: string | undefined;
  office?: string | undefined;
  noticeType?: string | undefined;
  baseNoticeType?: string | undefined;
  postedDate?: string | undefined;
  /** As published by SAM, including its stated offset/timezone. */
  responseDeadline?: string | undefined;
  naicsCode?: string | undefined;
  pscCode?: string | undefined;
  setAside?: string | undefined;
  setAsideDescription?: string | undefined;
  placeOfPerformance?:
    | {
        city?: string | undefined;
        state?: string | undefined;
        zip?: string | undefined;
        country?: string | undefined;
      }
    | undefined;
  active?: boolean | undefined;
  /** Public SAM notice page. */
  url?: string | undefined;
  /** API link to the full description (requires the API key to read). */
  descriptionUrl?: string | undefined;
  attachmentCount: number;
  pointOfContact?:
    | {
        name?: string | undefined;
        email?: string | undefined;
        phone?: string | undefined;
      }
    | undefined;
}

export type OpportunitySearchStatus = 'OK' | 'NOT_CONFIGURED' | 'ERROR';

export interface OpportunitySearchResult {
  status: OpportunitySearchStatus;
  provider: string;
  retrievedAt: string;
  query: Record<string, string>;
  totalRecords: number;
  opportunities: ContractOpportunity[];
  /** Human-readable reason when status is not OK. Never contains secrets. */
  error?: string;
}

export interface GovConOpportunityConnector {
  readonly provider: string;
  readonly configured: boolean;
  searchOpportunities(search: OpportunitySearch): Promise<OpportunitySearchResult>;
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

/** ISO YYYY-MM-DD → SAM's MM/dd/yyyy. */
export function toSamDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

function isoDaysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10);
}

interface SamQuery {
  [param: string]: string | undefined;
  postedFrom: string;
  postedTo: string;
  limit: string;
  offset: string;
  title?: string;
  ncode?: string;
  ccode?: string;
  typeOfSetAside?: string;
  ptype?: string;
  state?: string;
  rdlfrom?: string;
  rdlto?: string;
}

/** Build SAM query parameters (without the API key). */
export function buildSamQuery(search: OpportunitySearch, now: Date = new Date()): Record<string, string> {
  const s = OpportunitySearchSchema.parse(search);
  const postedTo = s.postedTo ?? now.toISOString().slice(0, 10);
  const postedFrom = s.postedFrom ?? isoDaysAgo(new Date(`${postedTo}T00:00:00Z`), 30);
  if (postedFrom > postedTo) throw new Error('postedFrom must be on or before postedTo');
  const spanDays = (Date.parse(postedTo) - Date.parse(postedFrom)) / 86_400_000;
  if (spanDays > 365) throw new Error('SAM.gov limits the posted-date window to one year');

  const q: SamQuery = {
    postedFrom: toSamDate(postedFrom),
    postedTo: toSamDate(postedTo),
    limit: String(s.limit),
    offset: String(s.offset),
  };
  if (s.keywords) q.title = s.keywords;
  if (s.naicsCode) q.ncode = s.naicsCode;
  if (s.pscCode) q.ccode = s.pscCode;
  if (s.setAside) q.typeOfSetAside = s.setAside.toUpperCase();
  if (s.noticeTypes?.length) q.ptype = s.noticeTypes.join(',');
  if (s.state) q.state = s.state.toUpperCase();
  if (s.responseDeadlineFrom) {
    q.rdlfrom = toSamDate(s.responseDeadlineFrom);
    // SAM requires both ends of the response-deadline range; one year out is the API ceiling.
    const rdlTo = new Date(Date.parse(`${s.responseDeadlineFrom}T00:00:00Z`) + 365 * 86_400_000);
    q.rdlto = toSamDate(rdlTo.toISOString().slice(0, 10));
  }
  return q as Record<string, string>;
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Fields read from a SAM v2 opportunitiesData record; everything is untrusted. */
export interface SamRawOpportunity {
  [field: string]: unknown;
  noticeId?: unknown;
  title?: unknown;
  solicitationNumber?: unknown;
  fullParentPathName?: unknown;
  department?: unknown;
  office?: unknown;
  type?: unknown;
  baseType?: unknown;
  postedDate?: unknown;
  responseDeadLine?: unknown;
  naicsCode?: unknown;
  naicsCodes?: unknown;
  classificationCode?: unknown;
  typeOfSetAside?: unknown;
  typeOfSetAsideDescription?: unknown;
  placeOfPerformance?: {
    city?: { name?: unknown };
    state?: { code?: unknown };
    zip?: unknown;
    country?: { code?: unknown };
  };
  active?: unknown;
  uiLink?: unknown;
  description?: unknown;
  resourceLinks?: unknown;
  pointOfContact?: unknown;
}

interface SamContact {
  type?: unknown;
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
}

/** Normalize one SAM v2 opportunitiesData record. Unknown/missing fields stay undefined. */
export function normalizeSamOpportunity(raw: SamRawOpportunity): ContractOpportunity {
  const pop = raw.placeOfPerformance ?? {};
  const contacts = Array.isArray(raw.pointOfContact) ? (raw.pointOfContact as SamContact[]) : [];
  const primary = contacts.find((c) => c.type === 'primary') ?? contacts[0];
  const path = str(raw.fullParentPathName);
  const pathParts = path ? path.split('.') : [];
  const naics = raw.naicsCode ?? (Array.isArray(raw.naicsCodes) ? raw.naicsCodes[0] : undefined);
  const noticeId = str(raw.noticeId) ?? '';

  return {
    source: 'sam.gov',
    noticeId,
    title: str(raw.title) ?? '(untitled notice)',
    solicitationNumber: str(raw.solicitationNumber),
    agency: pathParts[0] ?? str(raw.department),
    office: pathParts.length > 1 ? pathParts[pathParts.length - 1] : str(raw.office),
    noticeType: str(raw.type),
    baseNoticeType: str(raw.baseType),
    postedDate: str(raw.postedDate),
    responseDeadline: str(raw.responseDeadLine),
    naicsCode: str(naics),
    pscCode: str(raw.classificationCode),
    setAside: str(raw.typeOfSetAside),
    setAsideDescription: str(raw.typeOfSetAsideDescription),
    placeOfPerformance: raw.placeOfPerformance
      ? {
          city: str(pop.city?.name),
          state: str(pop.state?.code),
          zip: str(pop.zip),
          country: str(pop.country?.code),
        }
      : undefined,
    active: raw.active === undefined ? undefined : String(raw.active).toLowerCase() === 'yes',
    url: str(raw.uiLink) ?? (noticeId ? `https://sam.gov/opp/${noticeId}/view` : undefined),
    descriptionUrl: str(raw.description),
    attachmentCount: Array.isArray(raw.resourceLinks) ? raw.resourceLinks.length : 0,
    pointOfContact: primary
      ? {
          name: str(primary.fullName),
          email: str(primary.email),
          phone: str(primary.phone),
        }
      : undefined,
  };
}

// ─────────────────────────────────────────
// ADAPTERS
// ─────────────────────────────────────────

export interface SamGovConnectorOptions {
  apiKey: string;
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export class SamGovOpportunitiesConnector implements GovConOpportunityConnector {
  readonly provider = 'sam.gov';
  readonly configured = true;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(opts: SamGovConnectorOptions) {
    if (!opts.apiKey) throw new Error('SamGovOpportunitiesConnector requires an API key');
    this.apiKey = opts.apiKey;
    this.endpoint = opts.endpoint ?? SAM_OPPORTUNITIES_ENDPOINT;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? (() => new Date());
  }

  async searchOpportunities(search: OpportunitySearch): Promise<OpportunitySearchResult> {
    const retrievedAt = this.now().toISOString();
    let query: Record<string, string>;
    try {
      query = buildSamQuery(search, this.now());
    } catch (e) {
      return this.failure(retrievedAt, {}, (e as Error).message);
    }

    const url = new URL(this.endpoint);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    url.searchParams.set('api_key', this.apiKey);

    let res: Response;
    try {
      res = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      return this.failure(retrievedAt, query, `SAM.gov request failed: ${this.redact((e as Error).message)}`);
    }

    if (!res.ok) {
      const detail = this.redact((await res.text().catch(() => '')).slice(0, 300));
      return this.failure(retrievedAt, query, `SAM.gov responded ${res.status}${detail ? `: ${detail}` : ''}`);
    }

    let body: { totalRecords?: unknown; opportunitiesData?: unknown };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      return this.failure(retrievedAt, query, 'SAM.gov returned a non-JSON response');
    }

    const rows = Array.isArray(body.opportunitiesData) ? (body.opportunitiesData as SamRawOpportunity[]) : [];
    return {
      status: 'OK',
      provider: this.provider,
      retrievedAt,
      query,
      totalRecords: typeof body.totalRecords === 'number' ? body.totalRecords : rows.length,
      opportunities: rows.map(normalizeSamOpportunity),
    };
  }

  private redact(text: string): string {
    return text.split(this.apiKey).join('[REDACTED]');
  }

  private failure(retrievedAt: string, query: Record<string, string>, error: string): OpportunitySearchResult {
    return {
      status: 'ERROR',
      provider: this.provider,
      retrievedAt,
      query,
      totalRecords: 0,
      opportunities: [],
      error,
    };
  }
}

export class UnconfiguredGovConConnector implements GovConOpportunityConnector {
  readonly provider = 'sam.gov';
  readonly configured = false;

  async searchOpportunities(search: OpportunitySearch): Promise<OpportunitySearchResult> {
    let query: Record<string, string> = {};
    try {
      query = buildSamQuery(search);
    } catch {
      // Report the configuration gap regardless of query validity.
    }
    return {
      status: 'NOT_CONFIGURED',
      provider: this.provider,
      retrievedAt: new Date().toISOString(),
      query,
      totalRecords: 0,
      opportunities: [],
      error: 'SAM_GOV_API_KEY is not set. No opportunities were retrieved.',
    };
  }
}

/** Select the adapter from environment configuration. */
export function createGovConConnectorFromEnv(
  env: Record<string, string | undefined> = process.env,
): GovConOpportunityConnector {
  const apiKey = env['SAM_GOV_API_KEY']?.trim();
  return apiKey ? new SamGovOpportunitiesConnector({ apiKey }) : new UnconfiguredGovConConnector();
}
