/**
 * Outbound message templates.
 *
 * Templates are the only content the autopilot sends without a human in the
 * loop (Level B routine communications). They never echo customer-supplied
 * text back, never quote prices, and never promise filing outcomes.
 */

import type { Intent } from './classifier.js';

export interface MailboxIdentity {
  address: string;
  displayName: string;
  teamInbox: string;
  ownerInbox: string;
  siteUrl: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
}

const REF_PREFIX = 'HRK';

/** Short, human-friendly thread reference embedded in subjects: `[Ref HRK-1A2B3C4D]`. */
export function threadRef(threadId: string): string {
  return `${REF_PREFIX}-${threadId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export function extractThreadRef(subject: string): string | null {
  const m = subject.match(/\[Ref (HRK-[0-9A-F]{8})\]/i);
  return m?.[1]?.toUpperCase() ?? null;
}

export function withRef(subject: string, threadId: string): string {
  const ref = threadRef(threadId);
  return subject.includes(`[Ref ${ref}]`) ? subject : `${subject} [Ref ${ref}]`;
}

export function replySubject(subject: string): string {
  return /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}

function firstName(name?: string): string {
  return name?.trim().split(/\s+/)[0] || 'there';
}

function signature(id: MailboxIdentity): string {
  return [
    '',
    '—',
    'Hutchrok Solutions Group',
    'Veteran Business Services · Fairview, TX',
    id.siteUrl,
    `Reply to this email any time — it reaches our operations desk at ${id.address}.`,
  ].join('\n');
}

const INTENT_NEXT_STEP: Record<Intent, string> = {
  filing: 'A filing operator will review your request and confirm the documents and next steps for your formation.',
  case_status: 'An operator is pulling your case file now and will reply with a status update.',
  membership: 'Our team will follow up with membership options and what each tier includes.',
  billing: 'Our billing desk will review your account and reply with details.',
  veteran_claims: 'A member of our veteran claims team will review your message and reach out.',
  federal_contracting: 'Our government contracting team will review your readiness and follow up.',
  gov_housing: 'Our housing consulting team will review your request and follow up.',
  marketing_services: 'Our launch services team will follow up to confirm scope and timeline.',
  credit: 'Our business credit team will review your request and follow up.',
  scheduling: 'We will reply with available times for a consultation.',
  unsubscribe: 'You have been removed from non-essential email.',
  spam: '',
  general: 'A Hutchrok operator will review your message and respond.',
};

const SECURITY_NOTICE = [
  '',
  'Security notice: your message appears to include sensitive information (such as an SSN,',
  'EIN, bank, or veteran record details). For your protection, please do not send these by',
  'email. We will provide a secure upload link if we need any documents.',
];

export function renderAcknowledgment(opts: {
  id: MailboxIdentity;
  threadId: string;
  intent: Intent;
  contactName?: string;
  originalSubject?: string;
  restrictedDataDetected?: boolean;
}): RenderedEmail {
  const base = opts.originalSubject ? replySubject(opts.originalSubject) : 'We received your message — Hutchrok Solutions Group';
  return {
    subject: withRef(base, opts.threadId),
    text: [
      `Hi ${firstName(opts.contactName)},`,
      '',
      'Thank you for contacting Hutchrok Solutions Group. Your message has been received and logged',
      `under reference ${threadRef(opts.threadId)}.`,
      '',
      INTENT_NEXT_STEP[opts.intent],
      'We respond within 1 business day (Mon–Fri, Central Time).',
      ...(opts.restrictedDataDetected ? SECURITY_NOTICE : []),
      signature(opts.id),
    ].join('\n'),
  };
}

export function renderLeadWelcome(opts: { id: MailboxIdentity; threadId: string; contactName?: string }): RenderedEmail {
  return {
    subject: withRef('Welcome to Hutchrok Solutions Group', opts.threadId),
    text: [
      `Hi ${firstName(opts.contactName)},`,
      '',
      'Thanks for signing up with Hutchrok Solutions Group. You are on our list for launch offers',
      'and veteran business resources.',
      '',
      'Have a question about forming your business, membership, or launch services? Just reply to',
      'this email — it goes straight to our operations desk.',
      signature(opts.id),
    ].join('\n'),
  };
}

export function renderServiceRequestAck(opts: {
  id: MailboxIdentity;
  threadId: string;
  contactName?: string;
  serviceName?: string;
}): RenderedEmail {
  const service = opts.serviceName ? ` for ${opts.serviceName}` : '';
  return {
    subject: withRef(`We received your service request${service}`, opts.threadId),
    text: [
      `Hi ${firstName(opts.contactName)},`,
      '',
      `Your service request${service} has been received (reference ${threadRef(opts.threadId)}).`,
      'A Hutchrok operator will follow up within 1–2 business days to confirm scope, timeline,',
      'and next steps.',
      signature(opts.id),
    ].join('\n'),
  };
}

export function renderFollowUp(opts: {
  id: MailboxIdentity;
  threadId: string;
  contactName?: string;
  subject: string;
}): RenderedEmail {
  return {
    subject: withRef(replySubject(opts.subject), opts.threadId),
    text: [
      `Hi ${firstName(opts.contactName)},`,
      '',
      'Following up on our last message — do you have any questions, or is there anything else',
      'you need from us to move forward? Just reply here and we will pick it up.',
      signature(opts.id),
    ].join('\n'),
  };
}

/** Holding reply used as the draft when no AI drafter is configured. */
export function renderHoldingReply(opts: {
  id: MailboxIdentity;
  threadId: string;
  intent: Intent;
  contactName?: string;
  subject: string;
}): RenderedEmail {
  return {
    subject: withRef(replySubject(opts.subject), opts.threadId),
    text: [
      `Hi ${firstName(opts.contactName)},`,
      '',
      '[Operator: replace this paragraph with the answer before approving.]',
      '',
      INTENT_NEXT_STEP[opts.intent],
      signature(opts.id),
    ].join('\n'),
  };
}

export function renderTeamNotification(opts: {
  title: string;
  lines: Array<[string, string | undefined]>;
  body?: string;
  approvalId?: string;
}): RenderedEmail {
  return {
    subject: `[Hutchrok OS] ${opts.title}`,
    text: [
      opts.title,
      '',
      ...opts.lines.map(([k, v]) => `${k}: ${v ?? '—'}`),
      ...(opts.body ? ['', '--- Message (sensitive data redacted) ---', opts.body] : []),
      ...(opts.approvalId
        ? ['', `A reply draft is waiting for approval: POST /api/v1/autopilot/approvals/${opts.approvalId}/approve`]
        : []),
      '',
      '— Hutchrok OS Site Autopilot',
    ].join('\n'),
  };
}

/** Wrap an operator/AI-drafted body with greeting-safe subject + signature. */
export function renderDraftedReply(opts: {
  id: MailboxIdentity;
  threadId: string;
  subject: string;
  body: string;
}): RenderedEmail {
  return {
    subject: withRef(replySubject(opts.subject), opts.threadId),
    text: [opts.body.trim(), signature(opts.id)].join('\n'),
  };
}
