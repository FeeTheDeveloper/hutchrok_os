/**
 * Tests: Site Autopilot — hutchrok.com signals + OS mailbox
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditService, InMemoryAuditSink } from '../packages/audit/src/index.js';
import { InMemoryApprovalStore } from '../packages/approvals/src/index.js';
import { MockEmailConnector, type InboundEmail } from '../packages/connectors/src/index.js';
import {
  AutopilotBeat,
  AutopilotEngine,
  InMemoryAutopilotStore,
  InMemoryEventPublisher,
  classifyIntent,
  detectSensitivity,
  redactSensitive,
  stripQuotedReply,
  threadRef,
  type ReplyDrafter,
  type SiteSignal,
} from '../packages/autopilot/src/index.js';

const MAILBOX = 'repo_addy@hutchrok.com';
const identity = {
  address: MAILBOX,
  displayName: 'Hutchrok Solutions Group',
  teamInbox: 'contact@hutchrok.com',
  ownerInbox: 'ceo@hutchrok.com',
  siteUrl: 'https://hutchrok.com',
};

function inbound(overrides: Partial<InboundEmail> = {}): InboundEmail {
  return {
    providerMessageId: `prov_${Math.random().toString(36).slice(2)}`,
    internetMessageId: `<${Math.random().toString(36).slice(2)}@gmail.com>`,
    references: [],
    from: 'client@example.com',
    fromName: 'Jordan Client',
    to: [MAILBOX],
    cc: [],
    subject: 'Question about my LLC filing',
    text: 'Hi, I want to start an LLC in Texas. What documents do I need for the filing fee waiver?',
    headers: {},
    provider: 'test',
    ...overrides,
  };
}

function contactSignal(overrides: Partial<SiteSignal> = {}): SiteSignal {
  return {
    signalId: `sig_${Math.random().toString(36).slice(2)}`,
    type: 'contact.submitted',
    occurredAt: new Date().toISOString(),
    source: 'hutchrok.com',
    contact: { name: 'Avery Vet', email: 'avery@example.com' },
    subject: 'Membership question',
    message: 'What does the premium membership include?',
    data: {},
    ...overrides,
  };
}

describe('Site Autopilot', () => {
  let store: InMemoryAutopilotStore;
  let mail: MockEmailConnector;
  let sink: InMemoryAuditSink;
  let events: InMemoryEventPublisher;
  let clock: Date;
  let engine: AutopilotEngine;

  function build(drafter?: ReplyDrafter): AutopilotEngine {
    return new AutopilotEngine({
      config: { identity, internalDomains: ['hutchrok.com'] },
      store,
      email: mail,
      audit: new AuditService(sink),
      approvalStore: new InMemoryApprovalStore(),
      events,
      now: () => clock,
      ...(drafter ? { drafter } : {}),
    });
  }

  beforeEach(() => {
    store = new InMemoryAutopilotStore();
    mail = new MockEmailConnector({ email: MAILBOX, name: 'Hutchrok Solutions Group' });
    sink = new InMemoryAuditSink();
    events = new InMemoryEventPublisher();
    clock = new Date('2026-09-28T15:00:00Z');
    engine = build();
  });

  describe('site signals', () => {
    it('acknowledges a contact form automatically and queues the real reply for Level C approval', async () => {
      const run = await engine.handleSiteSignal(contactSignal());

      expect(run.duplicate).toBe(false);
      expect(run.intent).toBe('membership');
      const ack = mail.sent.find((m) => m.to[0] === 'avery@example.com');
      expect(ack).toBeDefined();
      expect(ack?.replyTo).toBe(MAILBOX);
      expect(ack?.subject).toContain(`[Ref ${threadRef(run.threadId!)}]`);

      const draftAction = run.actions.find((a) => a.kind === 'draft_reply');
      expect(draftAction?.status).toBe('pending_approval');
      const pending = await engine.approvals.getPending({ level: 'C' });
      expect(pending).toHaveLength(1);
      expect(pending[0]?.entityType).toBe('email_reply');

      // Team notification goes to the team inbox and links the approval.
      const notice = mail.sent.find((m) => m.to[0] === 'contact@hutchrok.com');
      expect(notice?.text).toContain(pending[0]!.id);
    });

    it('ignores replayed signals (idempotent on signalId)', async () => {
      const signal = contactSignal();
      await engine.handleSiteSignal(signal);
      const sentBefore = mail.sent.length;
      const replay = await engine.handleSiteSignal(signal);
      expect(replay.duplicate).toBe(true);
      expect(mail.sent.length).toBe(sentBefore);
    });

    it('does not re-acknowledge filing intakes (the site already emails the client)', async () => {
      const run = await engine.handleSiteSignal(
        contactSignal({ type: 'intake.submitted', subject: undefined, message: undefined, entity: { type: 'filing_case', ref: 'HSG-2026-1234' } }),
      );
      expect(mail.sent.some((m) => m.to[0] === 'avery@example.com')).toBe(false);
      expect(run.actions.map((a) => a.kind)).toEqual(['create_task', 'notify_team']);
      const tasks = await store.listTasks();
      expect(tasks[0]?.queue).toBe('filings');
    });

    it('raises a Level C approval when a case becomes ready for filing', async () => {
      const run = await engine.handleSiteSignal(
        contactSignal({ type: 'case.status_changed', contact: undefined, data: { new_status: 'READY_FOR_FILING' } }),
      );
      const approval = run.actions.find((a) => a.kind === 'require_approval');
      expect(approval?.status).toBe('pending_approval');
      const pending = await engine.approvals.getPending({ entityType: 'filing_submission' });
      expect(pending[0]?.level).toBe('C');
    });

    it('allows only operational labels into the event payload', async () => {
      await engine.handleSiteSignal(contactSignal({
        type: 'lead.created',
        data: { email: 'x@y.com', interests: ['logo'], nested: { ssn: '123-45-6789' }, page: '/lead', selectedService: 'DD-214 review' },
      }));
      const evt = events.events.find((e) => e.event_type === 'lead.created');
      expect(JSON.stringify(evt?.payload)).not.toContain('x@y.com');
      expect(JSON.stringify(evt?.payload)).not.toContain('123-45-6789');
      expect(JSON.stringify(evt?.payload)).not.toContain('DD-214');
      expect(evt?.payload['data']).toEqual({ page: '/lead', selectedService: '[REDACTED]' });
    });
  });

  describe('inbound email', () => {
    it('does not attach another sender to a thread through a copied Message-ID', async () => {
      const first = await engine.handleInboundEmail(inbound({ from: 'first@example.com', internetMessageId: '<known@example.com>' }));
      const second = await engine.handleInboundEmail(inbound({
        from: 'second@example.com',
        internetMessageId: '<other@example.com>',
        inReplyTo: '<known@example.com>',
      }));
      expect(second.threadId).not.toBe(first.threadId);
      expect((await store.getThread(first.threadId!))?.contactEmail).toBe('first@example.com');
      expect((await store.getThread(second.threadId!))?.contactEmail).toBe('second@example.com');
    });

    it('threads a customer reply to the acknowledgment back onto the site thread', async () => {
      const run = await engine.handleSiteSignal(contactSignal());
      const ack = mail.sent.find((m) => m.to[0] === 'avery@example.com')!;

      const reply = await engine.handleInboundEmail(
        inbound({
          from: 'avery@example.com',
          subject: `Re: ${ack.subject}`,
          inReplyTo: ack.result.internetMessageId,
          text: 'Thanks! Also, can I get an invoice?\n\nOn Mon, Hutchrok wrote:\n> Thank you for contacting',
        }),
      );

      expect(reply.threadId).toBe(run.threadId);
      expect(reply.intent).toBe('billing');
      const thread = await store.getThread(run.threadId!);
      expect(thread?.messages.filter((m) => m.direction === 'INBOUND')).toHaveLength(2);
      expect(thread?.status).toBe('awaiting_team');
      // Existing thread → no second acknowledgment.
      expect(mail.sent.filter((m) => m.to[0] === 'avery@example.com')).toHaveLength(1);
    });

    it('supersedes a stale reply draft when the customer writes again', async () => {
      const first = await engine.handleInboundEmail(inbound());
      const staleApproval = first.actions.find((a) => a.kind === 'draft_reply')!.refId!;
      await engine.handleInboundEmail(inbound({ subject: 'Re: Question about my LLC filing', text: 'One more thing — what is a VVL?' }));

      const pending = await engine.approvals.getPending({ entityType: 'email_reply' });
      expect(pending).toHaveLength(1);
      expect(pending[0]?.id).not.toBe(staleApproval);
      await expect(engine.approveDraft(staleApproval, 'owner-user')).rejects.toThrow(/rejected/);
    });

    it('sends the approved reply from the OS mailbox with threading headers', async () => {
      const run = await engine.handleInboundEmail(inbound());
      const approvalId = run.actions.find((a) => a.kind === 'draft_reply')!.refId!;

      const draft = await engine.approveDraft(approvalId, 'owner-user', { text: 'Here is exactly what you need…' });
      expect(draft.status).toBe('sent');

      const sent = mail.sent.at(-1)!;
      expect(sent.text).toBe('Here is exactly what you need…');
      expect(sent.replyTo).toBe(MAILBOX);
      expect(sent.inReplyTo).toBeDefined();
      const thread = await store.getThread(run.threadId!);
      expect(thread?.status).toBe('awaiting_customer');
    });

    it('never sends RESTRICTED content to the AI drafter and warns the customer', async () => {
      const seen: string[] = [];
      engine = build({ name: 'spy', draft: async (input) => (seen.push(input.customerMessage), 'draft') });

      const run = await engine.handleInboundEmail(inbound({ text: 'My SSN is 123-45-6789, please file my LLC.' }));

      expect(run.sensitivity).toBe('RESTRICTED');
      expect(seen).toHaveLength(0);
      const ack = mail.sent.find((m) => m.to[0] === 'client@example.com');
      expect(ack?.text).toContain('Security notice');
      const notice = mail.sent.find((m) => m.to[0] === 'contact@hutchrok.com');
      expect(notice?.text).not.toContain('123-45-6789');
      const thread = await store.getThread(run.threadId!);
      expect(JSON.stringify(thread)).not.toContain('123-45-6789');
    });

    it('passes redacted context to the AI drafter for normal mail', async () => {
      const seen: string[] = [];
      engine = build({ name: 'spy', draft: async (input) => (seen.push(input.customerMessage), 'You will need a VVL.') });
      const run = await engine.handleInboundEmail(inbound());
      expect(seen).toHaveLength(1);
      const draft = (await store.listDrafts({ status: 'pending_approval' }))[0];
      expect(draft?.generatedBy).toBe('ai');
      expect(draft?.text).toContain('You will need a VVL.');
      expect(run.actions.find((a) => a.kind === 'draft_reply')?.status).toBe('pending_approval');
    });

    it('does not auto-reply to automated mail, internal staff, or itself (loop guard)', async () => {
      await engine.handleInboundEmail(inbound({ from: 'mailer-daemon@googlemail.com', subject: 'Delivery Status Notification' }));
      await engine.handleInboundEmail(inbound({ headers: { 'auto-submitted': 'auto-replied' } }));
      await engine.handleInboundEmail(inbound({ from: 'staff@hutchrok.com' }));
      await engine.handleInboundEmail(inbound({ from: MAILBOX }));
      expect(mail.sent).toHaveLength(0);
    });

    it('honors unsubscribe requests and suppresses future automated mail', async () => {
      await engine.handleInboundEmail(inbound({ subject: 'unsubscribe', text: 'Please unsubscribe me' }));
      expect(await store.isSuppressed('client@example.com')).toBe(true);
      const run = await engine.handleInboundEmail(inbound({ subject: 'New question', text: 'about my llc' }));
      expect(run.actions.find((a) => a.kind === 'acknowledge')?.status).toBe('skipped');
    });

    it('dedupes the same inbound message delivered twice', async () => {
      const email = inbound();
      await engine.handleInboundEmail(email);
      const second = await engine.handleInboundEmail(email);
      expect(second.duplicate).toBe(true);
    });

    it('writes an audit trail for every action', async () => {
      await engine.handleInboundEmail(inbound());
      const actions = sink.getAll().map((r) => r.actionType);
      expect(actions).toEqual(
        expect.arrayContaining(['autopilot.email.received', 'autopilot.email.sent', 'autopilot.create_task', 'autopilot.draft.pending_approval', 'autopilot.notify_team']),
      );
    });
  });

  describe('beat', () => {
    it('escalates overdue tasks, follows up quiet threads once, and digests pending approvals', async () => {
      const run = await engine.handleInboundEmail(inbound());
      const approvalId = run.actions.find((a) => a.kind === 'draft_reply')!.refId!;
      await engine.handleInboundEmail(inbound({ from: 'other@example.com', subject: 'Business credit help', text: 'tradelines?' }));
      await engine.approveDraft(approvalId, 'owner-user', { text: 'Answer' });

      const beat = new AutopilotBeat(engine, store, new AuditService(sink), {}, () => clock);
      clock = new Date(clock.getTime() + 4 * 86_400_000);
      const sentBefore = mail.sent.length;
      const report = await beat.tick();

      expect(report.escalatedTasks).toBeGreaterThan(0);
      expect(report.followUpsSent).toBe(1);
      expect(report.approvalsInDigest).toBe(1);
      expect(mail.sent.length).toBeGreaterThan(sentBefore);

      // Second tick: nothing new to follow up, digest unchanged → quiet.
      const again = await beat.tick();
      expect(again.followUpsSent).toBe(0);
      expect(again.approvalsInDigest).toBe(0);
    });
  });
});

describe('Classifier', () => {
  it('routes common hutchrok.com intents', () => {
    expect(classifyIntent('How do I start an LLC? Need the certificate of formation').intent).toBe('filing');
    expect(classifyIntent('Can I get a refund on my invoice').intent).toBe('billing');
    expect(classifyIntent('Help registering on SAM.gov as an SDVOSB').intent).toBe('federal_contracting');
    expect(classifyIntent('Please unsubscribe me').intent).toBe('unsubscribe');
    expect(classifyIntent('Hello there').intent).toBe('general');
  });

  it('detects and redacts RESTRICTED data', () => {
    expect(detectSensitivity('my ssn 123-45-6789').classification).toBe('RESTRICTED');
    expect(detectSensitivity('routing number 111000025').classification).toBe('RESTRICTED');
    expect(detectSensitivity('attached is my DD-214').classification).toBe('RESTRICTED');
    expect(detectSensitivity('card 4242 4242 4242 4242').classification).toBe('RESTRICTED');
    expect(detectSensitivity('I paid $250').classification).toBe('CONFIDENTIAL');
    expect(detectSensitivity('hello').classification).toBe('INTERNAL');
    expect(redactSensitive('ssn 123-45-6789 ein 12-3456789')).toBe('ssn [REDACTED:SSN] ein [REDACTED:EIN]');
  });

  it('strips quoted history from replies', () => {
    expect(stripQuotedReply('New text\n\nOn Tue, X wrote:\n> old')).toBe('New text');
  });
});
