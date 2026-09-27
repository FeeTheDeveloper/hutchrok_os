/**
 * Deterministic message classification.
 *
 * Intent routing and sensitivity detection run without any AI model so the
 * autopilot keeps working when providers are down and so RESTRICTED data is
 * caught before anything could reach a model.
 */

import type { InboundEmail } from '@hutchrok-os/connectors';

// ─────────────────────────────────────────
// INTENT
// ─────────────────────────────────────────

export const INTENTS = [
  'filing',
  'case_status',
  'membership',
  'billing',
  'veteran_claims',
  'federal_contracting',
  'gov_housing',
  'marketing_services',
  'credit',
  'scheduling',
  'unsubscribe',
  'spam',
  'general',
] as const;

export type Intent = (typeof INTENTS)[number];

const INTENT_RULES: Array<{ intent: Exclude<Intent, 'general'>; patterns: RegExp[] }> = [
  { intent: 'unsubscribe', patterns: [/\bunsubscribe\b/, /\bstop (emailing|sending|contacting)\b/, /\bremove me\b/, /\bopt[- ]?out\b/] },
  { intent: 'spam', patterns: [/\bseo (services|ranking)\b/, /\bguest post\b/, /\bcrypto (investment|opportunity)\b/, /\bbacklinks?\b/, /\bwire transfer\b.*\binheritance\b/] },
  { intent: 'case_status', patterns: [/\bcase (number|status)\b/, /\bstatus of my\b/, /\bhsg-\d+/, /\btrack(ing)? my\b/, /\bany update\b/, /\bwhere (are we|is my)\b/] },
  { intent: 'filing', patterns: [/\bllc\b/, /\bform(ation)? (filing|documents?)\b/, /\bcertificate of formation\b/, /\bsecretary of state\b/, /\bfiling fee\b/, /\bfee waiver\b/, /\bregistered agent\b/, /\bvvl\b/, /\bverification letter\b/] },
  { intent: 'membership', patterns: [/\bmembership\b/, /\bsubscription\b/, /\bmember(ship)? (tier|plan)\b/, /\bpremium\b/] },
  { intent: 'billing', patterns: [/\binvoice\b/, /\brefund\b/, /\bcharged?\b/, /\bpayment\b/, /\breceipt\b/, /\bbilling\b/] },
  { intent: 'veteran_claims', patterns: [/\bva claim\b/, /\bdisability rating\b/, /\bdenial\b.*\bappeal\b/, /\bappeal\b.*\bva\b/, /\bc&p exam\b/] },
  { intent: 'federal_contracting', patterns: [/\bsam\.gov\b/, /\bfederal contract/, /\bsdvosb\b/, /\bvosb\b/, /\bgovcon\b/, /\bcage code\b/, /\buei\b/, /\bsolicitation\b/] },
  { intent: 'gov_housing', patterns: [/\bhud\b/, /\bsection 8\b/, /\bgovernment housing\b/, /\bhousing (authority|consult)/] },
  { intent: 'marketing_services', patterns: [/\bwebsite\b/, /\blogo\b/, /\bbrand(ing)?\b/, /\bmarketing\b/, /\bdomain\b/, /\bbusiness email\b/] },
  { intent: 'credit', patterns: [/\bbusiness credit\b/, /\bduns\b/, /\bcredit (builder|enablement|profile)\b/, /\btradelines?\b/] },
  { intent: 'scheduling', patterns: [/\bschedule\b/, /\bappointment\b/, /\bconsultation\b/, /\bbook a (call|meeting)\b/, /\bcall me\b/] },
];

export interface IntentResult {
  intent: Intent;
  confidence: number;
  matched: string[];
}

export function classifyIntent(text: string): IntentResult {
  const haystack = text.toLowerCase();
  let best: IntentResult = { intent: 'general', confidence: 0.3, matched: [] };

  for (const rule of INTENT_RULES) {
    const matched = rule.patterns.filter((p) => p.test(haystack)).map((p) => p.source);
    if (matched.length === 0) continue;
    // Unsubscribe/spam win on a single hit; other intents compete on hit count.
    const confidence = Math.min(0.95, 0.55 + matched.length * 0.15);
    if (rule.intent === 'unsubscribe' || rule.intent === 'spam') {
      return { intent: rule.intent, confidence, matched };
    }
    if (confidence > best.confidence) best = { intent: rule.intent, confidence, matched };
  }

  return best;
}

// ─────────────────────────────────────────
// SENSITIVITY
// ─────────────────────────────────────────

export type Sensitivity = 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface SensitivityResult {
  classification: Sensitivity;
  findings: string[];
}

const RESTRICTED_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { label: 'SSN', pattern: /\b(ssn|social security( number)?)\b[^\d]{0,20}\d{9}\b/i },
  { label: 'EIN', pattern: /\b\d{2}-\d{7}\b/ },
  { label: 'BANK_ACCOUNT', pattern: /\b(routing|account|acct)( number| no\.?| #)?\b[^\d]{0,20}\d{8,17}\b/i },
  { label: 'VETERAN_RECORD', pattern: /\bdd[- ]?214\b/i },
  { label: 'CARD_NUMBER', pattern: /\b(?:\d[ -]?){13,19}\b/ },
];

const CONFIDENTIAL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'PAYMENT_AMOUNT', pattern: /\$\s?\d[\d,]*(\.\d{2})?/ },
  { label: 'DATE_OF_BIRTH', pattern: /\b(dob|date of birth)\b/i },
];

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

export function detectSensitivity(text: string): SensitivityResult {
  const findings = new Set<string>();

  for (const { label, pattern } of RESTRICTED_PATTERNS) {
    const m = text.match(pattern);
    if (!m) continue;
    if (label === 'CARD_NUMBER' && !luhnValid(m[0].replace(/\D/g, ''))) continue;
    findings.add(label);
  }
  if (findings.size > 0) return { classification: 'RESTRICTED', findings: [...findings] };

  for (const { label, pattern } of CONFIDENTIAL_PATTERNS) {
    if (pattern.test(text)) findings.add(label);
  }
  if (findings.size > 0) return { classification: 'CONFIDENTIAL', findings: [...findings] };

  return { classification: 'INTERNAL', findings: [] };
}

// ─────────────────────────────────────────
// REDACTION — applied before any model call or team notification
// ─────────────────────────────────────────

export function redactSensitive(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED:SSN]')
    .replace(/\b(ssn|social security( number)?)\b([^\d]{0,20})\d{9}\b/gi, '$1$3[REDACTED:SSN]')
    .replace(/\b\d{2}-\d{7}\b/g, '[REDACTED:EIN]')
    .replace(/\b(routing|account|acct)( number| no\.?| #)?\b([^\d]{0,20})\d{8,17}\b/gi, '$1$2$3[REDACTED:ACCOUNT]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, (m) => (luhnValid(m.replace(/\D/g, '')) ? '[REDACTED:CARD]' : m));
}

// ─────────────────────────────────────────
// MAIL HYGIENE
// ─────────────────────────────────────────

/** Remove quoted history so classification only sees the new reply. */
export function stripQuotedReply(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+wrote:\s*$/.test(line.trim())) break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break;
    if (/^From: .+/.test(line.trim()) && out.length > 0) break;
    if (line.trim().startsWith('>')) continue;
    out.push(line);
  }
  return out.join('\n').trim();
}

/**
 * True when the inbound message is machine-generated (auto-replies, bounces,
 * bulk mail) or originates from the OS mailbox itself. The autopilot never
 * auto-replies to these — this is the mail-loop guard.
 */
export function isAutomatedMail(email: InboundEmail, mailboxAddress: string): boolean {
  const from = email.from.toLowerCase();
  if (from === mailboxAddress.toLowerCase()) return true;
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?)[@+]/.test(from)) return true;

  const h = email.headers;
  const autoSubmitted = h['auto-submitted']?.toLowerCase();
  if (autoSubmitted && autoSubmitted !== 'no') return true;
  if (/^(bulk|list|junk|auto_reply)$/i.test(h['precedence'] ?? '')) return true;
  if (h['x-autoreply'] || h['x-autorespond'] || h['list-unsubscribe'] || h['list-id']) return true;
  if (/^(auto(matic)? reply|out of (the )?office|delivery status notification|undeliverable)/i.test(email.subject)) return true;
  return false;
}
