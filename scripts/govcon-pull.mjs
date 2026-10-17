#!/usr/bin/env node
/**
 * Hutchrok OS — pull SAM.gov contract opportunities into a local research register.
 *
 *   pnpm govcon:pull -- --set-aside SDVOSBC --naics 541511 --open
 *
 * Flags: --keywords <title words> --naics <code> --psc <code> --set-aside <code>
 *        --type <o,k,p,r,...> --state <XX> --from <YYYY-MM-DD> --to <YYYY-MM-DD>
 *        --open (response deadline today or later) --limit <n> --out <dir>
 *
 * Requires SAM_GOV_API_KEY. Output goes to .govcon/ (gitignored). Read-only:
 * nothing is submitted, followed or messaged.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { createGovConConnectorFromEnv } from '../packages/connectors/dist/index.js';

const { values } = parseArgs({
  options: {
    keywords: { type: 'string' },
    naics: { type: 'string' },
    psc: { type: 'string' },
    'set-aside': { type: 'string' },
    type: { type: 'string' },
    state: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    open: { type: 'boolean', default: false },
    limit: { type: 'string', default: '100' },
    out: { type: 'string', default: '.govcon' },
  },
});

const today = new Date().toISOString().slice(0, 10);
const search = {
  keywords: values.keywords,
  naicsCode: values.naics,
  pscCode: values.psc,
  setAside: values['set-aside'],
  noticeTypes: values.type ? values.type.split(',') : undefined,
  state: values.state,
  postedFrom: values.from,
  postedTo: values.to,
  responseDeadlineFrom: values.open ? today : undefined,
  limit: Number(values.limit),
};

const connector = createGovConConnectorFromEnv();
const result = await connector.searchOpportunities(search);

if (result.status !== 'OK') {
  console.error(`[govcon] ${result.status}: ${result.error}`);
  process.exit(2);
}

const stamp = result.retrievedAt.replace(/[:.]/g, '-');
mkdirSync(values.out, { recursive: true });
const jsonPath = join(values.out, `sam-opportunities-${stamp}.json`);
writeFileSync(jsonPath, JSON.stringify(result, null, 2));

const esc = (s) => String(s ?? '—').replace(/\|/g, '\\|');
const lines = [
  `# SAM.gov opportunity register — ${result.retrievedAt}`,
  '',
  `Source: SAM.gov Get Opportunities Public API v2. Query: \`${JSON.stringify(result.query)}\`. ` +
    `${result.opportunities.length} of ${result.totalRecords} records. Research leads only — verify notice, attachments and amendments before any bid/no-bid.`,
  '',
  '| Notice | Title | Agency | Type | Set-aside | NAICS | PSC | Response deadline | Place |',
  '|---|---|---|---|---|---|---|---|---|',
  ...result.opportunities.map(
    (o) =>
      `| [${esc(o.solicitationNumber ?? o.noticeId)}](${o.url}) | ${esc(o.title)} | ${esc(o.agency)} | ${esc(o.noticeType)} | ${esc(o.setAside)} | ${esc(o.naicsCode)} | ${esc(o.pscCode)} | ${esc(o.responseDeadline)} | ${esc(o.placeOfPerformance?.state)} |`,
  ),
];
const mdPath = join(values.out, `sam-opportunities-${stamp}.md`);
writeFileSync(mdPath, lines.join('\n') + '\n');

console.log(`[govcon] ${result.opportunities.length}/${result.totalRecords} opportunities → ${mdPath}`);
