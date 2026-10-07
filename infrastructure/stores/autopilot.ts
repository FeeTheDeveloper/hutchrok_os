/**
 * Hutchrok OS — Postgres autopilot store
 *
 * Maps the email/site lane onto email_threads, email_messages, email_drafts,
 * autopilot_tasks and email_contacts.
 *
 * Two things are worth knowing:
 *
 * 1. `claimKey` does not keep its own key set. It delegates to the activity
 *    kernel's receipt service, so the email and site lanes share one
 *    idempotency record with every webhook. That is the whole point of
 *    passing a claimer in rather than reimplementing dedupe here.
 *
 * 2. `Thread.messages` is a nested array in the domain model but a child
 *    table in Postgres. `saveThread` upserts the thread then upserts each
 *    message by id, so repeated saves of a growing thread converge instead of
 *    duplicating rows.
 */

import { sql } from 'drizzle-orm';
import type {
  AutopilotStore,
  AutopilotTask,
  DraftStatus,
  EmailDraft,
  TaskStatus,
  Thread,
  ThreadMessage,
  ThreadStatus,
} from '@hutchrok-os/autopilot';

import {
  col,
  firstRow,
  rowsOf,
  toBool,
  toISO,
  toISOOptional,
  toInt,
  toStringArray,
  toStringOptional,
  type SqlExecutor,
} from './sql.js';

type Row = Record<string, unknown>;

/** Claims an idempotency key once. Satisfied by ProviderReceiptService. */
export interface KeyClaimer {
  claimKey(key: string): Promise<boolean>;
}

// ─────────────────────────────────────────
// MAPPERS
// ─────────────────────────────────────────

function mapMessage(row: Row): ThreadMessage {
  const internetMessageId = toStringOptional(col(row, 'internet_message_id'));
  const providerMessageId = toStringOptional(col(row, 'provider_message_id'));
  const kind = toStringOptional(col(row, 'kind')) as ThreadMessage['kind'] | undefined;

  return {
    id: String(col(row, 'id')),
    direction: String(col(row, 'direction')) as ThreadMessage['direction'],
    from: String(col(row, 'from_address')),
    to: toStringArray(col(row, 'to_addresses')),
    subject: String(col(row, 'subject')),
    textRedacted: String(col(row, 'text_redacted')),
    ...(internetMessageId !== undefined ? { internetMessageId } : {}),
    ...(providerMessageId !== undefined ? { providerMessageId } : {}),
    at: toISO(col(row, 'sent_at')),
    ...(kind !== undefined ? { kind } : {}),
  };
}

function mapThread(row: Row, messages: ThreadMessage[]): Thread {
  const contactName = toStringOptional(col(row, 'contact_name'));
  const signalId = toStringOptional(col(row, 'signal_id'));
  const lastInboundAt = toISOOptional(col(row, 'last_inbound_at'));
  const lastOutboundAt = toISOOptional(col(row, 'last_outbound_at'));

  return {
    id: String(col(row, 'id')),
    ref: String(col(row, 'ref')),
    contactEmail: String(col(row, 'contact_email')),
    ...(contactName !== undefined ? { contactName } : {}),
    subject: String(col(row, 'subject')),
    subjectKey: String(col(row, 'subject_key')),
    intent: String(col(row, 'intent')) as Thread['intent'],
    sensitivity: String(col(row, 'sensitivity')) as Thread['sensitivity'],
    status: String(col(row, 'status')) as ThreadStatus,
    source: String(col(row, 'source')) as Thread['source'],
    ...(signalId !== undefined ? { signalId } : {}),
    messages,
    ...(lastInboundAt !== undefined ? { lastInboundAt } : {}),
    ...(lastOutboundAt !== undefined ? { lastOutboundAt } : {}),
    followUpsSent: toInt(col(row, 'follow_ups_sent')),
    createdAt: toISO(col(row, 'created_at')),
    updatedAt: toISO(col(row, 'updated_at')),
  };
}

function mapDraft(row: Row): EmailDraft {
  const threadId = toStringOptional(col(row, 'thread_id'));
  const inReplyTo = toStringOptional(col(row, 'in_reply_to'));
  const approvalId = toStringOptional(col(row, 'approval_id'));
  const providerMessageId = toStringOptional(col(row, 'provider_message_id'));
  const error = toStringOptional(col(row, 'error'));
  const references = toStringArray(col(row, 'references'));

  return {
    id: String(col(row, 'id')),
    ...(threadId !== undefined ? { threadId } : {}),
    kind: String(col(row, 'kind')) as EmailDraft['kind'],
    to: toStringArray(col(row, 'to_addresses')),
    subject: String(col(row, 'subject')),
    text: String(col(row, 'body')),
    ...(inReplyTo !== undefined ? { inReplyTo } : {}),
    ...(references.length > 0 ? { references } : {}),
    ...(approvalId !== undefined ? { approvalId } : {}),
    status: String(col(row, 'status')) as DraftStatus,
    generatedBy: String(col(row, 'generated_by')) as EmailDraft['generatedBy'],
    ...(providerMessageId !== undefined ? { providerMessageId } : {}),
    ...(error !== undefined ? { error } : {}),
    correlationId: String(col(row, 'correlation_id')),
    createdAt: toISO(col(row, 'created_at')),
    updatedAt: toISO(col(row, 'updated_at')),
  };
}

function mapTask(row: Row): AutopilotTask {
  const threadId = toStringOptional(col(row, 'thread_id'));
  const signalId = toStringOptional(col(row, 'signal_id'));
  const escalatedAt = toISOOptional(col(row, 'escalated_at'));

  return {
    id: String(col(row, 'id')),
    queue: String(col(row, 'queue')),
    title: String(col(row, 'title')),
    agentId: String(col(row, 'agent_id')),
    status: String(col(row, 'status')) as TaskStatus,
    ...(threadId !== undefined ? { threadId } : {}),
    ...(signalId !== undefined ? { signalId } : {}),
    dueAt: toISO(col(row, 'due_at')),
    ...(escalatedAt !== undefined ? { escalatedAt } : {}),
    correlationId: String(col(row, 'correlation_id')),
    createdAt: toISO(col(row, 'created_at')),
    updatedAt: toISO(col(row, 'updated_at')),
  };
}

// ─────────────────────────────────────────
// STORE
// ─────────────────────────────────────────

export class PgAutopilotStore implements AutopilotStore {
  constructor(
    private readonly db: SqlExecutor,
    /** Shared idempotency, so this store keeps no key set of its own. */
    private readonly keys: KeyClaimer
  ) {}

  async claimKey(key: string): Promise<boolean> {
    return this.keys.claimKey(key);
  }

  // ───────────── Threads ─────────────

  async saveThread(thread: Thread): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO email_threads (
        id, ref, contact_email, contact_name, subject, subject_key, intent,
        sensitivity, status, source, signal_id, last_inbound_at,
        last_outbound_at, follow_ups_sent, created_at, updated_at
      ) VALUES (
        ${thread.id}, ${thread.ref}, ${thread.contactEmail},
        ${thread.contactName ?? null}, ${thread.subject}, ${thread.subjectKey},
        ${thread.intent}, ${thread.sensitivity}, ${thread.status}, ${thread.source},
        ${thread.signalId ?? null}, ${thread.lastInboundAt ?? null},
        ${thread.lastOutboundAt ?? null}, ${thread.followUpsSent},
        ${thread.createdAt}, ${thread.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        contact_name     = EXCLUDED.contact_name,
        subject          = EXCLUDED.subject,
        subject_key      = EXCLUDED.subject_key,
        intent           = EXCLUDED.intent,
        sensitivity      = EXCLUDED.sensitivity,
        status           = EXCLUDED.status,
        signal_id        = EXCLUDED.signal_id,
        last_inbound_at  = EXCLUDED.last_inbound_at,
        last_outbound_at = EXCLUDED.last_outbound_at,
        follow_ups_sent  = EXCLUDED.follow_ups_sent,
        updated_at       = EXCLUDED.updated_at
    `);

    // Messages live in a child table; upsert by id so a growing thread
    // converges rather than duplicating rows on every save.
    for (const m of thread.messages) {
      await this.db.execute(sql`
        INSERT INTO email_messages (
          id, thread_id, direction, kind, from_address, to_addresses, subject,
          text_redacted, internet_message_id, provider_message_id, sent_at,
          created_at, updated_at
        ) VALUES (
          ${m.id}, ${thread.id}, ${m.direction}, ${m.kind ?? null}, ${m.from},
          ${JSON.stringify(m.to)}::jsonb, ${m.subject}, ${m.textRedacted},
          ${m.internetMessageId ?? null}, ${m.providerMessageId ?? null},
          ${m.at}, ${m.at}, ${m.at}
        )
        ON CONFLICT (id) DO UPDATE SET
          kind                = EXCLUDED.kind,
          text_redacted       = EXCLUDED.text_redacted,
          provider_message_id = EXCLUDED.provider_message_id,
          updated_at          = now()
      `);
    }
  }

  private async loadMessages(threadId: string): Promise<ThreadMessage[]> {
    const result = await this.db.execute(sql`
      SELECT * FROM email_messages WHERE thread_id = ${threadId} ORDER BY sent_at, id
    `);
    return rowsOf<Row>(result).map(mapMessage);
  }

  private async hydrate(row: Row | null): Promise<Thread | null> {
    if (!row) return null;
    const messages = await this.loadMessages(String(col(row, 'id')));
    return mapThread(row, messages);
  }

  async getThread(id: string): Promise<Thread | null> {
    const result = await this.db.execute(sql`SELECT * FROM email_threads WHERE id = ${id}`);
    return this.hydrate(firstRow<Row>(result));
  }

  async findThreadByRef(ref: string): Promise<Thread | null> {
    const result = await this.db.execute(sql`SELECT * FROM email_threads WHERE ref = ${ref}`);
    return this.hydrate(firstRow<Row>(result));
  }

  async findThreadByMessageIds(ids: string[]): Promise<Thread | null> {
    if (ids.length === 0) return null;
    const idList = sql.join(
      ids.map((i) => sql`${i}`),
      sql`, `
    );
    const result = await this.db.execute(sql`
      SELECT t.* FROM email_threads t
      JOIN email_messages m ON m.thread_id = t.id
      WHERE m.internet_message_id IN (${idList})
      ORDER BY t.updated_at DESC
      LIMIT 1
    `);
    return this.hydrate(firstRow<Row>(result));
  }

  async findRecentThread(
    contactEmail: string,
    subjectKey: string,
    sinceISO: string
  ): Promise<Thread | null> {
    const result = await this.db.execute(sql`
      SELECT * FROM email_threads
      WHERE contact_email = ${contactEmail}
        AND subject_key = ${subjectKey}
        AND updated_at >= ${sinceISO}
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    return this.hydrate(firstRow<Row>(result));
  }

  async listThreads(
    filter: { status?: ThreadStatus; limit?: number } = {}
  ): Promise<Thread[]> {
    const where = filter.status ? sql`WHERE status = ${filter.status}` : sql``;
    const result = await this.db.execute(sql`
      SELECT * FROM email_threads ${where}
      ORDER BY updated_at DESC
      LIMIT ${filter.limit ?? 100}
    `);

    const threads: Thread[] = [];
    for (const row of rowsOf<Row>(result)) {
      const hydrated = await this.hydrate(row);
      if (hydrated) threads.push(hydrated);
    }
    return threads;
  }

  // ───────────── Drafts ─────────────

  async saveDraft(draft: EmailDraft): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO email_drafts (
        id, thread_id, kind, to_addresses, subject, body, in_reply_to,
        "references", approval_id, status, generated_by, provider_message_id,
        error, correlation_id, created_at, updated_at
      ) VALUES (
        ${draft.id}, ${draft.threadId ?? null}, ${draft.kind},
        ${JSON.stringify(draft.to)}::jsonb, ${draft.subject}, ${draft.text},
        ${draft.inReplyTo ?? null}, ${JSON.stringify(draft.references ?? [])}::jsonb,
        ${draft.approvalId ?? null}, ${draft.status}, ${draft.generatedBy},
        ${draft.providerMessageId ?? null}, ${draft.error ?? null},
        ${draft.correlationId}, ${draft.createdAt}, ${draft.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        thread_id           = EXCLUDED.thread_id,
        subject             = EXCLUDED.subject,
        body                = EXCLUDED.body,
        in_reply_to         = EXCLUDED.in_reply_to,
        "references"        = EXCLUDED."references",
        approval_id         = EXCLUDED.approval_id,
        status              = EXCLUDED.status,
        generated_by        = EXCLUDED.generated_by,
        provider_message_id = EXCLUDED.provider_message_id,
        error               = EXCLUDED.error,
        updated_at          = EXCLUDED.updated_at
    `);
  }

  async getDraft(id: string): Promise<EmailDraft | null> {
    const result = await this.db.execute(sql`SELECT * FROM email_drafts WHERE id = ${id}`);
    const row = firstRow<Row>(result);
    return row ? mapDraft(row) : null;
  }

  async findDraftByApproval(approvalId: string): Promise<EmailDraft | null> {
    const result = await this.db.execute(sql`
      SELECT * FROM email_drafts WHERE approval_id = ${approvalId} LIMIT 1
    `);
    const row = firstRow<Row>(result);
    return row ? mapDraft(row) : null;
  }

  async listDrafts(
    filter: { status?: DraftStatus; limit?: number } = {}
  ): Promise<EmailDraft[]> {
    const where = filter.status ? sql`WHERE status = ${filter.status}` : sql``;
    const result = await this.db.execute(sql`
      SELECT * FROM email_drafts ${where}
      ORDER BY created_at DESC
      LIMIT ${filter.limit ?? 100}
    `);
    return rowsOf<Row>(result).map(mapDraft);
  }

  // ───────────── Tasks ─────────────

  async saveTask(task: AutopilotTask): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO autopilot_tasks (
        id, queue, title, agent_id, status, thread_id, signal_id, due_at,
        escalated_at, correlation_id, created_at, updated_at
      ) VALUES (
        ${task.id}, ${task.queue}, ${task.title}, ${task.agentId}, ${task.status},
        ${task.threadId ?? null}, ${task.signalId ?? null}, ${task.dueAt},
        ${task.escalatedAt ?? null}, ${task.correlationId},
        ${task.createdAt}, ${task.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        title        = EXCLUDED.title,
        status       = EXCLUDED.status,
        thread_id    = EXCLUDED.thread_id,
        signal_id    = EXCLUDED.signal_id,
        due_at       = EXCLUDED.due_at,
        escalated_at = EXCLUDED.escalated_at,
        updated_at   = EXCLUDED.updated_at
    `);
  }

  async listTasks(
    filter: { status?: TaskStatus; queue?: string; limit?: number } = {}
  ): Promise<AutopilotTask[]> {
    const conditions = [sql`TRUE`];
    if (filter.status) conditions.push(sql`status = ${filter.status}`);
    if (filter.queue) conditions.push(sql`queue = ${filter.queue}`);
    const where = sql.join(conditions, sql` AND `);

    const result = await this.db.execute(sql`
      SELECT * FROM autopilot_tasks WHERE ${where}
      ORDER BY due_at
      LIMIT ${filter.limit ?? 100}
    `);
    return rowsOf<Row>(result).map(mapTask);
  }

  // ───────────── Contact state (consent / cooldown) ─────────────

  async isSuppressed(email: string): Promise<boolean> {
    const result = await this.db.execute(sql`
      SELECT suppressed FROM email_contacts WHERE email = ${email.toLowerCase()}
    `);
    const row = firstRow<Row>(result);
    return row ? toBool(col(row, 'suppressed')) : false;
  }

  async suppress(email: string): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO email_contacts (id, email, suppressed, suppressed_reason)
      VALUES (gen_random_uuid(), ${email.toLowerCase()}, true, 'unsubscribe')
      ON CONFLICT (email) DO UPDATE SET
        suppressed        = true,
        suppressed_reason = COALESCE(email_contacts.suppressed_reason, 'unsubscribe'),
        updated_at        = now()
    `);
  }

  async lastAcknowledgedAt(email: string): Promise<string | null> {
    const result = await this.db.execute(sql`
      SELECT last_acknowledged_at FROM email_contacts WHERE email = ${email.toLowerCase()}
    `);
    const row = firstRow<Row>(result);
    if (!row) return null;
    return toISOOptional(col(row, 'last_acknowledged_at')) ?? null;
  }

  async markAcknowledged(email: string, atISO: string): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO email_contacts (id, email, last_acknowledged_at)
      VALUES (gen_random_uuid(), ${email.toLowerCase()}, ${atISO})
      ON CONFLICT (email) DO UPDATE SET
        last_acknowledged_at = EXCLUDED.last_acknowledged_at,
        updated_at           = now()
    `);
  }
}
