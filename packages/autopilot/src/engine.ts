/**
 * Site Autopilot Engine
 *
 * Runs every hutchrok.com action and every email to the OS mailbox through
 * the same governed pipeline:
 *
 *   dedupe → classify → playbook → policy → approval → execute → audit → event
 *
 * Governance:
 * - Acknowledgments and follow-ups are templated Level B routine messages
 *   (auto-approved by policy).
 * - Substantive replies — AI-drafted or not — are Level C: a human approves
 *   them before anything is sent.
 * - RESTRICTED data (SSN, EIN, bank, veteran records) never reaches a model
 *   and is redacted from notifications and stored thread history.
 * - The mailbox never auto-replies to automated mail, internal senders, or
 *   suppressed contacts (mail-loop and consent guards).
 */

import type { Approval } from '@hutchrok-os/domain';
import { ApprovalService, type ApprovalLevel, type ApprovalStore } from '@hutchrok-os/approvals';
import type { AuditService } from '@hutchrok-os/audit';
import type { EmailConnector, InboundEmail } from '@hutchrok-os/connectors';
import { createEvent, type EventEnvelope, type RiskLevel } from '@hutchrok-os/events';
import { evaluateActionPolicy } from '@hutchrok-os/policies';
import { generateCorrelationId, generateId } from '@hutchrok-os/shared';
import {
  classifyIntent,
  detectSensitivity,
  isAutomatedMail,
  redactSensitive,
  stripQuotedReply,
  type Intent,
  type Sensitivity,
} from './classifier.js';
import { inboundEmailPlaybook, playbookFor, type AckTemplate, type PlaybookStep } from './playbooks.js';
import { osEventTypeFor, type SiteSignal } from './signals.js';
import type { AutopilotStore, AutopilotTask, EmailDraft, DraftKind, Thread, ThreadMessage } from './store.js';
import {
  extractThreadRef,
  renderAcknowledgment,
  renderDraftedReply,
  renderFollowUp,
  renderHoldingReply,
  renderLeadWelcome,
  renderServiceRequestAck,
  renderTeamNotification,
  threadRef,
  type MailboxIdentity,
  type RenderedEmail,
} from './templates.js';

export const AUTOPILOT_AGENT_ID = 'site-autopilot';

// ─────────────────────────────────────────
// CONTRACTS
// ─────────────────────────────────────────

export interface DraftInput {
  intent: Intent;
  subject: string;
  /** Latest customer message, RESTRICTED data already redacted. */
  customerMessage: string;
  contactName?: string;
  history: Array<{ direction: 'INBOUND' | 'OUTBOUND'; text: string }>;
  correlationId: string;
}

/** Produces the body of a reply draft. Output always goes to Level C review. */
export interface ReplyDrafter {
  readonly name: string;
  draft(input: DraftInput): Promise<string | null>;
}

export interface EventPublisher {
  publish(event: EventEnvelope): Promise<void>;
}

export class InMemoryEventPublisher implements EventPublisher {
  readonly events: EventEnvelope[] = [];
  async publish(event: EventEnvelope): Promise<void> {
    this.events.push(event);
  }
}

export interface AutopilotConfig {
  identity: MailboxIdentity;
  /** Sender domains treated as staff — recorded, never auto-answered. */
  internalDomains?: string[];
  ackCooldownHours?: number;
  threadMatchWindowDays?: number;
}

export interface AutopilotDeps {
  config: AutopilotConfig;
  store: AutopilotStore;
  email: EmailConnector;
  audit: AuditService;
  approvalStore: ApprovalStore;
  events?: EventPublisher;
  drafter?: ReplyDrafter;
  now?: () => Date;
}

export type ActionStatus = 'executed' | 'pending_approval' | 'skipped' | 'failed';

export interface ActionOutcome {
  kind: string;
  status: ActionStatus;
  detail?: string;
  refId?: string;
}

export interface AutopilotRun {
  runId: string;
  trigger: 'site_signal' | 'inbound_email';
  correlationId: string;
  duplicate: boolean;
  eventId?: string;
  threadId?: string;
  intent?: Intent;
  sensitivity?: Sensitivity;
  actions: ActionOutcome[];
}

interface StepContext {
  correlationId: string;
  thread: Thread | null;
  intent: Intent;
  sensitivity: Sensitivity;
  contactName?: string;
  contactEmail?: string;
  /** Redacted text of the triggering message. */
  messageRedacted: string;
  subject: string;
  signal?: SiteSignal;
  inbound?: InboundEmail;
  approvalIdForNotice?: string;
}

// ─────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────

export class AutopilotEngine {
  readonly approvals: ApprovalService;
  private readonly events: EventPublisher;
  private readonly now: () => Date;

  constructor(private readonly deps: AutopilotDeps) {
    this.events = deps.events ?? new InMemoryEventPublisher();
    this.now = deps.now ?? (() => new Date());
    this.approvals = new ApprovalService(deps.approvalStore, {
      onApproved: (a) => this.onApproved(a),
      onRejected: (a) => this.onRejected(a),
    });
  }

  get identity(): MailboxIdentity {
    return this.deps.config.identity;
  }

  // ───────────── Site signals ─────────────

  async handleSiteSignal(signal: SiteSignal): Promise<AutopilotRun> {
    const correlationId = generateCorrelationId();
    const run: AutopilotRun = { runId: generateId(), trigger: 'site_signal', correlationId, duplicate: false, actions: [] };

    if (!(await this.deps.store.claimKey(`signal:${signal.signalId}`))) {
      run.duplicate = true;
      return run;
    }

    const rawText = [signal.subject, signal.message].filter(Boolean).join('\n');
    const sens = detectSensitivity(rawText);
    const intent = signal.type === 'contact.submitted' ? classifyIntent(rawText).intent : this.intentForSignal(signal);
    run.intent = intent;
    run.sensitivity = sens.classification;

    const event = createEvent({
      event_type: osEventTypeFor(signal.type),
      source: signal.source,
      actor: signal.contact?.email ?? 'anonymous',
      ...(signal.entity?.type ? { entity_type: signal.entity.type } : {}),
      ...(signal.entity?.id ? { entity_id: signal.entity.id } : {}),
      payload: {
        signalId: signal.signalId,
        signalType: signal.type,
        entityRef: signal.entity?.ref,
        intent,
        data: this.safeData(signal.data),
      },
      metadata: { occurredAt: signal.occurredAt, sensitivity: sens.classification },
      correlation_id: correlationId,
      risk_level: this.riskFor(sens.classification),
    });
    await this.events.publish(event);
    run.eventId = event.event_id;

    await this.audit('autopilot.signal.received', 'SUCCESS', correlationId, {
      entityType: 'site_signal',
      entityId: signal.signalId,
      metadata: { type: signal.type, intent, sensitivity: sens.classification, findings: sens.findings },
    });

    const steps = playbookFor(signal, intent);
    const needsThread = Boolean(signal.contact?.email) && steps.some((s) => s.kind === 'acknowledge' || s.kind === 'draft_reply');
    const messageRedacted = redactSensitive(signal.message ?? '');
    const subject = signal.subject ?? this.defaultSubjectFor(signal);

    let thread: Thread | null = null;
    if (needsThread && signal.contact?.email) {
      thread = this.newThread({
        contactEmail: signal.contact.email.toLowerCase(),
        ...(signal.contact.name ? { contactName: signal.contact.name } : {}),
        subject,
        intent,
        sensitivity: sens.classification,
        source: 'site',
        signalId: signal.signalId,
      });
      thread.messages.push({
        id: generateId(),
        direction: 'INBOUND',
        from: signal.contact.email.toLowerCase(),
        to: [this.identity.address],
        subject,
        textRedacted: messageRedacted,
        at: this.nowISO(),
        kind: 'site_form',
      });
      thread.lastInboundAt = this.nowISO();
      await this.deps.store.saveThread(thread);
      run.threadId = thread.id;
    }

    const ctx: StepContext = {
      correlationId,
      thread,
      intent,
      sensitivity: sens.classification,
      messageRedacted,
      subject,
      signal,
      ...(signal.contact?.name ? { contactName: signal.contact.name } : {}),
      ...(signal.contact?.email ? { contactEmail: signal.contact.email.toLowerCase() } : {}),
    };

    run.actions = await this.runSteps(steps, ctx);
    return run;
  }

  // ───────────── Inbound email ─────────────

  async handleInboundEmail(email: InboundEmail): Promise<AutopilotRun> {
    const correlationId = generateCorrelationId();
    const run: AutopilotRun = { runId: generateId(), trigger: 'inbound_email', correlationId, duplicate: false, actions: [] };

    const dedupeKey = `email:${email.internetMessageId ?? email.providerMessageId}`;
    if (!(await this.deps.store.claimKey(dedupeKey))) {
      run.duplicate = true;
      return run;
    }

    const from = email.from.toLowerCase();
    const newText = stripQuotedReply(email.text) || email.text;
    const sens = detectSensitivity(`${email.subject}\n${newText}`);
    const intent = classifyIntent(`${email.subject}\n${newText}`).intent;
    const automated = isAutomatedMail(email, this.identity.address);
    const internal = this.isInternalSender(from);
    run.intent = intent;
    run.sensitivity = sens.classification;

    const event = createEvent({
      event_type: 'message.received',
      source: 'os-mailbox',
      actor: from,
      entity_type: 'email',
      entity_id: email.providerMessageId,
      payload: { channel: 'email', provider: email.provider, intent, automated, internal, subject: email.subject },
      metadata: { sensitivity: sens.classification },
      correlation_id: correlationId,
      risk_level: this.riskFor(sens.classification),
    });
    await this.events.publish(event);
    run.eventId = event.event_id;

    if (automated || internal) {
      await this.audit('autopilot.email.ignored', 'SUCCESS', correlationId, {
        entityType: 'email',
        entityId: email.providerMessageId,
        metadata: { reason: automated ? 'automated_mail' : 'internal_sender' },
      });
      run.actions.push({ kind: 'record', status: 'skipped', detail: automated ? 'automated mail — no auto-reply' : 'internal sender — no auto-reply' });
      return run;
    }

    if (intent === 'unsubscribe') {
      await this.deps.store.suppress(from);
      await this.audit('autopilot.contact.suppressed', 'SUCCESS', correlationId, { entityType: 'contact', entityId: from });
      await this.events.publish(
        createEvent({ event_type: 'customer.updated', source: 'site-autopilot', actor: AUTOPILOT_AGENT_ID, payload: { email: from, suppressed: true }, correlation_id: correlationId }),
      );
      run.actions.push({ kind: 'suppress', status: 'executed', detail: 'contact removed from automated email' });
      return run;
    }

    const existing = await this.resolveThread(email, from);
    const thread =
      existing ??
      this.newThread({
        contactEmail: from,
        ...(email.fromName ? { contactName: email.fromName } : {}),
        subject: email.subject,
        intent,
        sensitivity: sens.classification,
        source: 'email',
      });

    thread.messages.push({
      id: generateId(),
      direction: 'INBOUND',
      from,
      to: email.to,
      subject: email.subject,
      textRedacted: redactSensitive(newText),
      ...(email.internetMessageId ? { internetMessageId: email.internetMessageId } : {}),
      providerMessageId: email.providerMessageId,
      at: this.nowISO(),
      kind: 'email',
    });
    thread.status = 'awaiting_team';
    thread.lastInboundAt = this.nowISO();
    if (thread.sensitivity !== 'RESTRICTED' && sens.classification !== 'INTERNAL') thread.sensitivity = sens.classification;
    if (sens.classification === 'RESTRICTED') thread.sensitivity = 'RESTRICTED';
    thread.updatedAt = this.nowISO();
    await this.deps.store.saveThread(thread);
    run.threadId = thread.id;

    await this.audit('autopilot.email.received', 'SUCCESS', correlationId, {
      entityType: 'email_thread',
      entityId: thread.id,
      metadata: { intent, sensitivity: sens.classification, findings: sens.findings, newThread: !existing },
    });

    const steps = inboundEmailPlaybook({ intent, automated, isNewThread: !existing });
    run.actions = await this.runSteps(steps, {
      correlationId,
      thread,
      intent,
      sensitivity: sens.classification,
      messageRedacted: redactSensitive(newText),
      subject: email.subject,
      inbound: email,
      contactEmail: from,
      ...(thread.contactName ? { contactName: thread.contactName } : {}),
    });
    return run;
  }

  // ───────────── Human decisions ─────────────

  async approveDraft(
    approvalId: string,
    approverUserId: string,
    edits: { subject?: string; text?: string } = {},
  ): Promise<EmailDraft> {
    const draft = await this.deps.store.findDraftByApproval(approvalId);
    if (!draft) throw new Error(`No draft is linked to approval ${approvalId}.`);
    if (draft.status !== 'pending_approval') throw new Error(`Draft ${draft.id} is ${draft.status}, not pending approval.`);

    if (edits.subject || edits.text) {
      await this.deps.store.saveDraft({
        ...draft,
        ...(edits.subject ? { subject: edits.subject } : {}),
        ...(edits.text ? { text: edits.text } : {}),
        updatedAt: this.nowISO(),
      });
    }
    await this.approvals.approve(approvalId, approverUserId);
    return (await this.deps.store.getDraft(draft.id)) ?? draft;
  }

  async rejectDraft(approvalId: string, userId: string, reason?: string): Promise<void> {
    await this.approvals.reject(approvalId, userId, reason);
  }

  /** Level B routine follow-up — used by the beat. */
  async sendFollowUp(thread: Thread): Promise<ActionOutcome> {
    const rendered = renderFollowUp({
      id: this.identity,
      threadId: thread.id,
      subject: thread.subject,
      ...(thread.contactName ? { contactName: thread.contactName } : {}),
    });
    const outcome = await this.queueOutbound('follow_up', thread, rendered, generateCorrelationId());
    if (outcome.status === 'executed') {
      const fresh = await this.deps.store.getThread(thread.id);
      if (fresh) {
        fresh.followUpsSent += 1;
        await this.deps.store.saveThread(fresh);
      }
    }
    return outcome;
  }

  /** Level A internal notification to the team inbox. */
  async notifyTeam(rendered: RenderedEmail, correlationId: string, replyTo?: string): Promise<ActionOutcome> {
    const result = await this.deps.email.send({
      to: [this.identity.teamInbox],
      subject: rendered.subject,
      text: rendered.text,
      ...(replyTo ? { replyTo } : {}),
      headers: { 'Auto-Submitted': 'auto-generated' },
      correlationId,
    });
    const ok = result.status !== 'failed';
    await this.audit('autopilot.notify_team', ok ? 'SUCCESS' : 'FAILURE', correlationId, {
      entityType: 'notification',
      entityId: result.messageId || 'unsent',
      ...(result.error ? { errorMessage: result.error } : {}),
    });
    return ok
      ? { kind: 'notify_team', status: 'executed', refId: result.messageId }
      : { kind: 'notify_team', status: 'failed', detail: result.error ?? 'send failed' };
  }

  // ───────────── Step execution ─────────────

  private async runSteps(steps: PlaybookStep[], ctx: StepContext): Promise<ActionOutcome[]> {
    const outcomes: ActionOutcome[] = [];
    // Draft first so the team notification can link the pending approval.
    const ordered = [...steps].sort((a, b) => this.stepOrder(a) - this.stepOrder(b));

    for (const step of ordered) {
      try {
        outcomes.push(await this.runStep(step, ctx));
      } catch (e) {
        const message = (e as Error).message;
        await this.audit(`autopilot.${step.kind}`, 'FAILURE', ctx.correlationId, { errorMessage: message });
        outcomes.push({ kind: step.kind, status: 'failed', detail: message });
      }
    }
    return outcomes;
  }

  private stepOrder(step: PlaybookStep): number {
    return { acknowledge: 0, create_task: 1, draft_reply: 2, require_approval: 3, notify_team: 4 }[step.kind];
  }

  private async runStep(step: PlaybookStep, ctx: StepContext): Promise<ActionOutcome> {
    switch (step.kind) {
      case 'acknowledge':
        return this.acknowledge(step.template, ctx);
      case 'create_task':
        return this.createTask(step, ctx);
      case 'draft_reply':
        return this.draftReply(ctx);
      case 'require_approval':
        return this.requireApproval(step, ctx);
      case 'notify_team':
        return this.notifyTeam(
          renderTeamNotification({
            title: step.title,
            lines: [
              ['From', ctx.contactName ? `${ctx.contactName} <${ctx.contactEmail ?? ''}>` : ctx.contactEmail],
              ['Subject', ctx.subject],
              ['Intent', ctx.intent],
              ['Sensitivity', ctx.sensitivity],
              ['Reference', ctx.thread ? threadRef(ctx.thread.id) : ctx.signal?.entity?.ref],
              ['Signal', ctx.signal?.type],
            ],
            ...(ctx.messageRedacted ? { body: ctx.messageRedacted } : {}),
            ...(ctx.approvalIdForNotice ? { approvalId: ctx.approvalIdForNotice } : {}),
          }),
          ctx.correlationId,
        );
    }
  }

  private async acknowledge(template: AckTemplate, ctx: StepContext): Promise<ActionOutcome> {
    if (!ctx.thread || !ctx.contactEmail) return { kind: 'acknowledge', status: 'skipped', detail: 'no contact email' };
    if (await this.deps.store.isSuppressed(ctx.contactEmail)) {
      return { kind: 'acknowledge', status: 'skipped', detail: 'contact suppressed' };
    }
    const last = await this.deps.store.lastAcknowledgedAt(ctx.contactEmail);
    const cooldownMs = (this.deps.config.ackCooldownHours ?? 24) * 3_600_000;
    if (last && this.now().getTime() - new Date(last).getTime() < cooldownMs) {
      return { kind: 'acknowledge', status: 'skipped', detail: 'acknowledged recently' };
    }

    const base = { id: this.identity, threadId: ctx.thread.id, ...(ctx.contactName ? { contactName: ctx.contactName } : {}) };
    const rendered =
      template === 'lead_welcome'
        ? renderLeadWelcome(base)
        : template === 'service_request'
          ? renderServiceRequestAck({
              ...base,
              ...(typeof ctx.signal?.data['selectedService'] === 'string' ? { serviceName: ctx.signal.data['selectedService'] } : {}),
            })
          : renderAcknowledgment({
              ...base,
              intent: ctx.intent,
              restrictedDataDetected: ctx.sensitivity === 'RESTRICTED',
              ...(ctx.inbound ? { originalSubject: ctx.inbound.subject } : {}),
            });

    const outcome = await this.queueOutbound('acknowledgment', ctx.thread, rendered, ctx.correlationId, ctx.inbound);
    if (outcome.status === 'executed') await this.deps.store.markAcknowledged(ctx.contactEmail, this.nowISO());
    return { ...outcome, kind: 'acknowledge' };
  }

  private async createTask(step: Extract<PlaybookStep, { kind: 'create_task' }>, ctx: StepContext): Promise<ActionOutcome> {
    const now = this.nowISO();
    const task: AutopilotTask = {
      id: generateId(),
      queue: step.queue,
      title: step.title,
      agentId: step.agentId,
      status: 'open',
      dueAt: new Date(this.now().getTime() + step.slaHours * 3_600_000).toISOString(),
      correlationId: ctx.correlationId,
      createdAt: now,
      updatedAt: now,
      ...(ctx.thread ? { threadId: ctx.thread.id } : {}),
      ...(ctx.signal ? { signalId: ctx.signal.signalId } : {}),
    };
    await this.deps.store.saveTask(task);
    await this.audit('autopilot.create_task', 'SUCCESS', ctx.correlationId, {
      entityType: 'autopilot_task',
      entityId: task.id,
      metadata: { queue: task.queue, agentId: task.agentId, dueAt: task.dueAt },
    });
    await this.events.publish(
      createEvent({
        event_type: 'agent.action.requested',
        source: 'site-autopilot',
        actor: AUTOPILOT_AGENT_ID,
        entity_type: 'autopilot_task',
        entity_id: task.id,
        payload: { agentId: task.agentId, queue: task.queue, title: task.title, dueAt: task.dueAt },
        correlation_id: ctx.correlationId,
      }),
    );
    return { kind: 'create_task', status: 'executed', refId: task.id, detail: `${task.queue} → ${task.agentId}` };
  }

  private async draftReply(ctx: StepContext): Promise<ActionOutcome> {
    if (!ctx.thread) return { kind: 'draft_reply', status: 'skipped', detail: 'no thread' };

    let rendered: RenderedEmail | null = null;
    let generatedBy: 'template' | 'ai' = 'template';

    // RESTRICTED threads never reach a model (kernel aiPermissions).
    if (this.deps.drafter && ctx.sensitivity !== 'RESTRICTED' && ctx.thread.sensitivity !== 'RESTRICTED') {
      try {
        const body = await this.deps.drafter.draft({
          intent: ctx.intent,
          subject: ctx.subject,
          customerMessage: ctx.messageRedacted,
          history: ctx.thread.messages.slice(-6).map((m) => ({ direction: m.direction, text: m.textRedacted })),
          correlationId: ctx.correlationId,
          ...(ctx.contactName ? { contactName: ctx.contactName } : {}),
        });
        if (body?.trim()) {
          rendered = renderDraftedReply({ id: this.identity, threadId: ctx.thread.id, subject: ctx.subject, body });
          generatedBy = 'ai';
        }
      } catch (e) {
        await this.audit('autopilot.draft_reply.ai', 'FAILURE', ctx.correlationId, { errorMessage: (e as Error).message });
      }
    }

    rendered ??= renderHoldingReply({
      id: this.identity,
      threadId: ctx.thread.id,
      intent: ctx.intent,
      subject: ctx.subject,
      ...(ctx.contactName ? { contactName: ctx.contactName } : {}),
    });

    const outcome = await this.queueOutbound('reply', ctx.thread, rendered, ctx.correlationId, ctx.inbound, generatedBy);
    if (outcome.status === 'pending_approval' && outcome.refId) ctx.approvalIdForNotice = outcome.refId;
    return { ...outcome, kind: 'draft_reply', detail: `${generatedBy} draft awaiting Level C approval` };
  }

  private async requireApproval(step: Extract<PlaybookStep, { kind: 'require_approval' }>, ctx: StepContext): Promise<ActionOutcome> {
    const approval = await this.approvals.request({
      level: step.level,
      entityType: step.entityType,
      entityId: generateId(),
      requestedByAgentId: AUTOPILOT_AGENT_ID,
      reason: step.reason,
      correlationId: ctx.correlationId,
      metadata: { signalId: ctx.signal?.signalId, entity: ctx.signal?.entity },
    });
    await this.audit('autopilot.require_approval', 'SUCCESS', ctx.correlationId, {
      entityType: 'approval',
      entityId: approval.id,
      metadata: { level: step.level, entityType: step.entityType },
    });
    return { kind: 'require_approval', status: 'pending_approval', refId: approval.id, detail: step.reason };
  }

  // ───────────── Outbound pipeline ─────────────

  /**
   * Create a draft and route it through policy + approvals. Routine messages
   * are auto-approved (and sent) inside approvals.request(); replies wait.
   */
  private async queueOutbound(
    kind: DraftKind,
    thread: Thread,
    rendered: RenderedEmail,
    correlationId: string,
    inReplyToEmail?: InboundEmail,
    generatedBy: 'template' | 'ai' = 'template',
  ): Promise<ActionOutcome> {
    const { level, entityType } = this.governanceFor(kind);
    if (kind === 'reply') await this.supersedePendingReplies(thread.id);
    const now = this.nowISO();
    const references = inReplyToEmail
      ? [...inReplyToEmail.references, ...(inReplyToEmail.internetMessageId ? [inReplyToEmail.internetMessageId] : [])]
      : thread.messages.map((m) => m.internetMessageId).filter((x): x is string => Boolean(x));

    const draft: EmailDraft = {
      id: generateId(),
      threadId: thread.id,
      kind,
      to: [thread.contactEmail],
      subject: rendered.subject,
      text: rendered.text,
      status: 'pending_approval',
      generatedBy,
      correlationId,
      createdAt: now,
      updatedAt: now,
      ...(inReplyToEmail?.internetMessageId ? { inReplyTo: inReplyToEmail.internetMessageId } : {}),
      ...(references.length ? { references } : {}),
    };
    await this.deps.store.saveDraft(draft);

    const approval = await this.approvals.request({
      level,
      entityType,
      entityId: draft.id,
      requestedByAgentId: AUTOPILOT_AGENT_ID,
      reason: `${kind} to ${thread.contactEmail}`,
      correlationId,
      metadata: { draftId: draft.id, threadId: thread.id, kind, generatedBy },
    });

    const saved = (await this.deps.store.getDraft(draft.id)) ?? draft;
    await this.deps.store.saveDraft({ ...saved, approvalId: approval.id });

    if (approval.status === 'PENDING') {
      await this.audit('autopilot.draft.pending_approval', 'SUCCESS', correlationId, {
        entityType: 'email_draft',
        entityId: draft.id,
        metadata: { approvalId: approval.id, level, kind, generatedBy },
      });
      return { kind, status: 'pending_approval', refId: approval.id };
    }

    const final = await this.deps.store.getDraft(draft.id);
    return final?.status === 'sent'
      ? { kind, status: 'executed', refId: final.providerMessageId ?? draft.id }
      : { kind, status: final?.status === 'failed' ? 'failed' : 'skipped', detail: final?.error ?? final?.status ?? 'unknown' };
  }

  /** A newer customer message makes older reply drafts stale — withdraw them. */
  private async supersedePendingReplies(threadId: string): Promise<void> {
    const pending = await this.deps.store.listDrafts({ status: 'pending_approval', limit: 1000 });
    for (const draft of pending) {
      if (draft.threadId !== threadId || draft.kind !== 'reply' || !draft.approvalId) continue;
      await this.approvals.reject(draft.approvalId, AUTOPILOT_AGENT_ID, 'Superseded by a newer draft on the same thread.');
    }
  }

  private governanceFor(kind: DraftKind): { level: ApprovalLevel; entityType: string } {
    if (kind === 'reply') return { level: 'C', entityType: 'email_reply' };

    const decision = evaluateActionPolicy({
      actorRole: 'AI_AGENT',
      actorType: 'AGENT',
      action: `communication.${kind}`,
      isExternal: true,
      isCommunication: true,
    });
    const level = decision.approvalLevel ?? 'B';
    return { level, entityType: kind === 'follow_up' ? 'routine_followup' : 'routine_status_message' };
  }

  private async onApproved(approval: Approval): Promise<void> {
    if (approval.entityType === 'filing_submission') {
      await this.events.publish(
        createEvent({
          event_type: 'filing.approved_for_submission',
          source: 'site-autopilot',
          actor: approval.approvedByUserId ?? 'unknown',
          entity_type: 'approval',
          entity_id: approval.id,
          payload: approval.metadata,
          ...(approval.correlationId ? { correlation_id: approval.correlationId } : {}),
          risk_level: 'HIGH',
        }),
      );
      return;
    }

    const draft = await this.deps.store.getDraft(approval.entityId);
    if (!draft) return;
    await this.dispatchDraft({ ...draft, approvalId: approval.id, status: 'approved' }, approval);
  }

  private async onRejected(approval: Approval): Promise<void> {
    const draft = await this.deps.store.getDraft(approval.entityId);
    if (!draft) return;
    await this.deps.store.saveDraft({ ...draft, status: 'rejected', updatedAt: this.nowISO() });
    await this.audit('autopilot.draft.rejected', 'SUCCESS', draft.correlationId, {
      actor: approval.approvedByUserId ?? 'unknown',
      actorType: 'USER',
      entityType: 'email_draft',
      entityId: draft.id,
      ...(approval.reason ? { metadata: { reason: approval.reason } } : {}),
    });
  }

  private async dispatchDraft(draft: EmailDraft, approval: Approval): Promise<void> {
    const automated = approval.status === 'AUTO_APPROVED';
    const recipient = draft.to[0] ?? '';
    if (automated && (await this.deps.store.isSuppressed(recipient))) {
      await this.deps.store.saveDraft({ ...draft, status: 'rejected', error: 'contact suppressed', updatedAt: this.nowISO() });
      return;
    }

    const result = await this.deps.email.send({
      to: draft.to,
      subject: draft.subject,
      text: draft.text,
      replyTo: this.identity.address,
      ...(draft.inReplyTo ? { inReplyTo: draft.inReplyTo } : {}),
      ...(draft.references ? { references: draft.references } : {}),
      ...(automated ? { headers: { 'Auto-Submitted': 'auto-replied' } } : {}),
      tags: { kind: draft.kind, source: 'hutchrok-os' },
      correlationId: draft.correlationId,
    });

    const sent = result.status !== 'failed';
    await this.deps.store.saveDraft({
      ...draft,
      status: sent ? 'sent' : 'failed',
      updatedAt: this.nowISO(),
      ...(result.messageId ? { providerMessageId: result.messageId } : {}),
      ...(result.error ? { error: result.error } : {}),
    });

    if (sent && draft.threadId) {
      const thread = await this.deps.store.getThread(draft.threadId);
      if (thread) {
        const message: ThreadMessage = {
          id: generateId(),
          direction: 'OUTBOUND',
          from: this.identity.address,
          to: draft.to,
          subject: draft.subject,
          textRedacted: redactSensitive(draft.text),
          internetMessageId: result.internetMessageId,
          providerMessageId: result.messageId,
          at: this.nowISO(),
          kind: draft.kind === 'follow_up' ? 'follow_up' : draft.kind === 'acknowledgment' ? 'acknowledgment' : 'reply',
        };
        thread.messages.push(message);
        thread.lastOutboundAt = message.at;
        // An acknowledgment does not answer the customer — the team still owes a reply.
        if (draft.kind !== 'acknowledgment') thread.status = 'awaiting_customer';
        thread.updatedAt = message.at;
        await this.deps.store.saveThread(thread);
      }
    }

    await this.audit('autopilot.email.sent', sent ? 'SUCCESS' : 'FAILURE', draft.correlationId, {
      actor: automated ? AUTOPILOT_AGENT_ID : (approval.approvedByUserId ?? 'unknown'),
      actorType: automated ? 'AGENT' : 'USER',
      entityType: 'email_draft',
      entityId: draft.id,
      metadata: { kind: draft.kind, approvalId: approval.id, level: approval.level, provider: this.deps.email.provider },
      ...(result.error ? { errorMessage: result.error } : {}),
    });
    if (sent) {
      await this.events.publish(
        createEvent({
          event_type: 'message.sent',
          source: 'os-mailbox',
          actor: automated ? AUTOPILOT_AGENT_ID : (approval.approvedByUserId ?? 'unknown'),
          entity_type: 'email_draft',
          entity_id: draft.id,
          payload: { channel: 'email', kind: draft.kind, threadId: draft.threadId, providerMessageId: result.messageId },
          correlation_id: draft.correlationId,
        }),
      );
    }
  }

  // ───────────── Helpers ─────────────

  private async resolveThread(email: InboundEmail, from: string): Promise<Thread | null> {
    const ref = extractThreadRef(email.subject);
    if (ref) {
      const byRef = await this.deps.store.findThreadByRef(ref);
      if (byRef && byRef.contactEmail === from) return byRef;
    }
    const ids = [...(email.inReplyTo ? [email.inReplyTo] : []), ...email.references];
    const byHeaders = await this.deps.store.findThreadByMessageIds(ids);
    if (byHeaders) return byHeaders;

    const windowDays = this.deps.config.threadMatchWindowDays ?? 30;
    const since = new Date(this.now().getTime() - windowDays * 86_400_000).toISOString();
    return this.deps.store.findRecentThread(from, subjectKey(email.subject), since);
  }

  private newThread(opts: {
    contactEmail: string;
    contactName?: string;
    subject: string;
    intent: Intent;
    sensitivity: Sensitivity;
    source: 'site' | 'email';
    signalId?: string;
  }): Thread {
    const id = generateId();
    const now = this.nowISO();
    return {
      id,
      ref: threadRef(id),
      contactEmail: opts.contactEmail,
      subject: opts.subject,
      subjectKey: subjectKey(opts.subject),
      intent: opts.intent,
      sensitivity: opts.sensitivity,
      status: 'awaiting_team',
      source: opts.source,
      messages: [],
      followUpsSent: 0,
      createdAt: now,
      updatedAt: now,
      ...(opts.contactName ? { contactName: opts.contactName } : {}),
      ...(opts.signalId ? { signalId: opts.signalId } : {}),
    };
  }

  private intentForSignal(signal: SiteSignal): Intent {
    switch (signal.type) {
      case 'lead.created':
        return 'marketing_services';
      case 'service_request.submitted':
        return 'marketing_services';
      case 'federal_intake.submitted':
        return 'federal_contracting';
      case 'payment.completed':
      case 'payment.failed':
        return 'billing';
      case 'membership.activated':
        return 'membership';
      case 'intake.submitted':
      case 'case.created':
      case 'case.status_changed':
      case 'case.event':
      case 'document.uploaded':
        return 'filing';
      default:
        return 'general';
    }
  }

  private defaultSubjectFor(signal: SiteSignal): string {
    return `Your ${signal.type.split('.')[0]?.replace(/_/g, ' ') ?? 'request'} with Hutchrok Solutions Group`;
  }

  /** Drop contact details from signal data before it lands in events. */
  private safeData(data: Record<string, unknown>): Record<string, unknown> {
    const blocked = new Set(['contact', 'email', 'phone', 'ssn', 'ein', 'dob', 'address']);
    return Object.fromEntries(Object.entries(data).filter(([k]) => !blocked.has(k.toLowerCase())));
  }

  private isInternalSender(from: string): boolean {
    const domain = from.split('@')[1] ?? '';
    return (this.deps.config.internalDomains ?? []).includes(domain);
  }

  private riskFor(s: Sensitivity): RiskLevel {
    return s === 'RESTRICTED' ? 'HIGH' : s === 'CONFIDENTIAL' ? 'MEDIUM' : 'LOW';
  }

  private nowISO(): string {
    return this.now().toISOString();
  }

  private async audit(
    actionType: string,
    result: 'SUCCESS' | 'FAILURE' | 'PARTIAL',
    correlationId: string,
    extra: {
      actor?: string;
      actorType?: 'USER' | 'AGENT' | 'SYSTEM' | 'CONNECTOR';
      entityType?: string;
      entityId?: string;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    await this.deps.audit.record({
      actor: extra.actor ?? AUTOPILOT_AGENT_ID,
      actorType: extra.actorType ?? 'AGENT',
      actionType,
      result,
      correlationId,
      source: 'site-autopilot',
      ...(extra.entityType ? { entityType: extra.entityType } : {}),
      ...(extra.entityId ? { entityId: extra.entityId } : {}),
      ...(extra.errorMessage ? { errorMessage: extra.errorMessage } : {}),
      ...(extra.metadata ? { metadata: extra.metadata } : {}),
    });
  }
}

export function subjectKey(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/\[ref hrk-[0-9a-f]{8}\]/gi, '')
    .replace(/^((re|fwd?|aw)\s*:\s*)+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
