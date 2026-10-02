/**
 * Operator API for the Site Autopilot (bearer API_SECRET_KEY).
 *
 * GET  /api/v1/autopilot/status
 * GET  /api/v1/autopilot/threads?status=awaiting_team
 * GET  /api/v1/autopilot/threads/:id
 * GET  /api/v1/autopilot/tasks?status=open&queue=filings
 * GET  /api/v1/autopilot/approvals            — pending Level C/D items
 * POST /api/v1/autopilot/approvals/:id/approve { subject?, text? }
 * POST /api/v1/autopilot/approvals/:id/reject  { reason? }
 * POST /api/v1/autopilot/beat/tick             — run the beat now
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { DraftStatus, TaskStatus, ThreadStatus } from '@hutchrok-os/autopilot';
import { autopilot, autopilotStore, beat, emailConnector } from '../autopilot.js';
import { identifyApprover, requireOperator } from '../middleware/security.js';

export const autopilotRouter = new Hono();

autopilotRouter.use('*', requireOperator);

const ApproveSchema = z.object({
  subject: z.string().min(1).max(300).optional(),
  text: z.string().min(1).max(20_000).optional(),
}).strict();

const RejectSchema = z.object({
  reason: z.string().max(1000).optional(),
}).strict();

async function authorizedApprover(id: string, key: string | undefined) {
  const identity = identifyApprover(key);
  if (!identity) return null;
  const pending = await autopilot.approvals.getPending();
  const approval = pending.find((item) => item.id === id);
  if (!approval || (approval.level === 'D' && identity.maxLevel !== 'D')) return null;
  return identity;
}

autopilotRouter.get('/status', async (c) => {
  const [awaitingTeam, openTasks, pending] = await Promise.all([
    autopilotStore.listThreads({ status: 'awaiting_team', limit: 1000 }),
    autopilotStore.listTasks({ status: 'open', limit: 1000 }),
    autopilot.approvals.getPending(),
  ]);
  return c.json({
    mailbox: autopilot.identity.address,
    emailProvider: emailConnector.provider,
    threadsAwaitingTeam: awaitingTeam.length,
    openTasks: openTasks.length,
    pendingApprovals: pending.length,
  });
});

autopilotRouter.get('/threads', async (c) => {
  const status = c.req.query('status') as ThreadStatus | undefined;
  const threads = await autopilotStore.listThreads({ ...(status ? { status } : {}), limit: 200 });
  return c.json({
    threads: threads.map(({ messages, ...t }) => ({ ...t, messageCount: messages.length })),
  });
});

autopilotRouter.get('/threads/:id', async (c) => {
  const thread = await autopilotStore.getThread(c.req.param('id'));
  return thread ? c.json({ thread }) : c.json({ error: 'Not found' }, 404);
});

autopilotRouter.get('/tasks', async (c) => {
  const status = c.req.query('status') as TaskStatus | undefined;
  const queue = c.req.query('queue');
  return c.json({ tasks: await autopilotStore.listTasks({ ...(status ? { status } : {}), ...(queue ? { queue } : {}), limit: 500 }) });
});

autopilotRouter.get('/drafts', async (c) => {
  const status = c.req.query('status') as DraftStatus | undefined;
  return c.json({ drafts: await autopilotStore.listDrafts({ ...(status ? { status } : {}), limit: 200 }) });
});

autopilotRouter.get('/approvals', async (c) => {
  const pending = await autopilot.approvals.getPending();
  const withDrafts = await Promise.all(
    pending.map(async (approval) => ({ approval, draft: await autopilotStore.findDraftByApproval(approval.id) })),
  );
  return c.json({ approvals: withDrafts });
});

autopilotRouter.post('/approvals/:id/approve', async (c) => {
  const parsed = ApproveSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid body', details: parsed.error.issues }, 400);

  const id = c.req.param('id');
  const approver = await authorizedApprover(id, c.req.header('x-hutchrok-approver-key'));
  if (!approver) return c.json({ error: 'Approver is not authorized for this pending approval' }, 403);
  try {
    const draft = await autopilotStore.findDraftByApproval(id);
    if (draft) {
      const sent = await autopilot.approveDraft(id, approver.userId, {
        ...(parsed.data.subject ? { subject: parsed.data.subject } : {}),
        ...(parsed.data.text ? { text: parsed.data.text } : {}),
      });
      return c.json({ draft: { id: sent.id, status: sent.status, error: sent.error } });
    }
    const approval = await autopilot.approvals.approve(id, approver.userId);
    return c.json({ approval });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 409);
  }
});

autopilotRouter.post('/approvals/:id/reject', async (c) => {
  const parsed = RejectSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Invalid body', details: parsed.error.issues }, 400);
  const approver = await authorizedApprover(c.req.param('id'), c.req.header('x-hutchrok-approver-key'));
  if (!approver) return c.json({ error: 'Approver is not authorized for this pending approval' }, 403);
  try {
    await autopilot.approvals.reject(c.req.param('id'), approver.userId, parsed.data.reason);
    return c.json({ rejected: true });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 409);
  }
});

autopilotRouter.post('/beat/tick', async (c) => c.json({ report: await beat.tick() }));
