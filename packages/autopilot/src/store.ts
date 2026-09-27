/**
 * Autopilot persistence contracts + in-memory implementation.
 *
 * The Postgres implementation maps onto the email_threads / email_messages /
 * email_drafts / autopilot_tasks / site_signals tables in
 * infrastructure/database/schema.ts.
 */

import type { Intent, Sensitivity } from './classifier.js';

export type ThreadStatus = 'open' | 'awaiting_team' | 'awaiting_customer' | 'closed';

export interface ThreadMessage {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  from: string;
  to: string[];
  subject: string;
  /** Body with RESTRICTED data redacted — raw bodies are never persisted here. */
  textRedacted: string;
  internetMessageId?: string;
  providerMessageId?: string;
  at: string;
  kind?: 'site_form' | 'email' | 'acknowledgment' | 'reply' | 'follow_up';
}

export interface Thread {
  id: string;
  ref: string;
  contactEmail: string;
  contactName?: string;
  subject: string;
  subjectKey: string;
  intent: Intent;
  sensitivity: Sensitivity;
  status: ThreadStatus;
  source: 'site' | 'email';
  signalId?: string;
  messages: ThreadMessage[];
  lastInboundAt?: string;
  lastOutboundAt?: string;
  followUpsSent: number;
  createdAt: string;
  updatedAt: string;
}

export type DraftKind = 'acknowledgment' | 'reply' | 'follow_up' | 'team_notification';
export type DraftStatus = 'pending_approval' | 'approved' | 'sent' | 'rejected' | 'failed';

export interface EmailDraft {
  id: string;
  threadId?: string;
  kind: DraftKind;
  to: string[];
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string[];
  approvalId?: string;
  status: DraftStatus;
  generatedBy: 'template' | 'ai';
  providerMessageId?: string;
  error?: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'open' | 'done' | 'escalated';

export interface AutopilotTask {
  id: string;
  queue: string;
  title: string;
  agentId: string;
  status: TaskStatus;
  threadId?: string;
  signalId?: string;
  dueAt: string;
  escalatedAt?: string;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutopilotStore {
  /** Returns true the first time a key is seen (idempotency). */
  claimKey(key: string): Promise<boolean>;

  saveThread(thread: Thread): Promise<void>;
  getThread(id: string): Promise<Thread | null>;
  findThreadByRef(ref: string): Promise<Thread | null>;
  findThreadByMessageIds(ids: string[]): Promise<Thread | null>;
  findRecentThread(contactEmail: string, subjectKey: string, sinceISO: string): Promise<Thread | null>;
  listThreads(filter?: { status?: ThreadStatus; limit?: number }): Promise<Thread[]>;

  saveDraft(draft: EmailDraft): Promise<void>;
  getDraft(id: string): Promise<EmailDraft | null>;
  findDraftByApproval(approvalId: string): Promise<EmailDraft | null>;
  listDrafts(filter?: { status?: DraftStatus; limit?: number }): Promise<EmailDraft[]>;

  saveTask(task: AutopilotTask): Promise<void>;
  listTasks(filter?: { status?: TaskStatus; queue?: string; limit?: number }): Promise<AutopilotTask[]>;

  isSuppressed(email: string): Promise<boolean>;
  suppress(email: string): Promise<void>;

  lastAcknowledgedAt(email: string): Promise<string | null>;
  markAcknowledged(email: string, atISO: string): Promise<void>;
}

export class InMemoryAutopilotStore implements AutopilotStore {
  private keys = new Set<string>();
  private threads = new Map<string, Thread>();
  private drafts = new Map<string, EmailDraft>();
  private tasks = new Map<string, AutopilotTask>();
  private suppressed = new Set<string>();
  private acks = new Map<string, string>();

  async claimKey(key: string): Promise<boolean> {
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    return true;
  }

  async saveThread(thread: Thread): Promise<void> {
    this.threads.set(thread.id, structuredClone(thread));
  }

  async getThread(id: string): Promise<Thread | null> {
    const t = this.threads.get(id);
    return t ? structuredClone(t) : null;
  }

  async findThreadByRef(ref: string): Promise<Thread | null> {
    const t = [...this.threads.values()].find((x) => x.ref === ref);
    return t ? structuredClone(t) : null;
  }

  async findThreadByMessageIds(ids: string[]): Promise<Thread | null> {
    if (ids.length === 0) return null;
    const wanted = new Set(ids);
    const t = [...this.threads.values()].find((x) =>
      x.messages.some((m) => m.internetMessageId !== undefined && wanted.has(m.internetMessageId)),
    );
    return t ? structuredClone(t) : null;
  }

  async findRecentThread(contactEmail: string, subjectKey: string, sinceISO: string): Promise<Thread | null> {
    const t = [...this.threads.values()]
      .filter((x) => x.contactEmail === contactEmail && x.subjectKey === subjectKey && x.updatedAt >= sinceISO)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return t ? structuredClone(t) : null;
  }

  async listThreads(filter: { status?: ThreadStatus; limit?: number } = {}): Promise<Thread[]> {
    return [...this.threads.values()]
      .filter((t) => !filter.status || t.status === filter.status)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, filter.limit ?? 100)
      .map((t) => structuredClone(t));
  }

  async saveDraft(draft: EmailDraft): Promise<void> {
    this.drafts.set(draft.id, { ...draft });
  }

  async getDraft(id: string): Promise<EmailDraft | null> {
    const d = this.drafts.get(id);
    return d ? { ...d } : null;
  }

  async findDraftByApproval(approvalId: string): Promise<EmailDraft | null> {
    const d = [...this.drafts.values()].find((x) => x.approvalId === approvalId);
    return d ? { ...d } : null;
  }

  async listDrafts(filter: { status?: DraftStatus; limit?: number } = {}): Promise<EmailDraft[]> {
    return [...this.drafts.values()]
      .filter((d) => !filter.status || d.status === filter.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, filter.limit ?? 100)
      .map((d) => ({ ...d }));
  }

  async saveTask(task: AutopilotTask): Promise<void> {
    this.tasks.set(task.id, { ...task });
  }

  async listTasks(filter: { status?: TaskStatus; queue?: string; limit?: number } = {}): Promise<AutopilotTask[]> {
    return [...this.tasks.values()]
      .filter((t) => (!filter.status || t.status === filter.status) && (!filter.queue || t.queue === filter.queue))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      .slice(0, filter.limit ?? 100)
      .map((t) => ({ ...t }));
  }

  async isSuppressed(email: string): Promise<boolean> {
    return this.suppressed.has(email.toLowerCase());
  }

  async suppress(email: string): Promise<void> {
    this.suppressed.add(email.toLowerCase());
  }

  async lastAcknowledgedAt(email: string): Promise<string | null> {
    return this.acks.get(email.toLowerCase()) ?? null;
  }

  async markAcknowledged(email: string, atISO: string): Promise<void> {
    this.acks.set(email.toLowerCase(), atISO);
  }
}
