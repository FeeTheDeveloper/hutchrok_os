/**
 * The Beat — the autopilot's heartbeat.
 *
 * On every tick the OS sweeps its own state and acts without being asked:
 * - SLA sweep:        overdue tasks escalate to the team inbox (Level A)
 * - Follow-up sweep:  quiet customer threads get one routine follow-up (Level B)
 * - Approval digest:  waiting Level C/D approvals are summarized for the owner
 */

import type { AuditService } from '@hutchrok-os/audit';
import type { ActionOutcome, AutopilotEngine } from './engine.js';
import type { AutopilotStore } from './store.js';
import { renderTeamNotification, threadRef } from './templates.js';
import { generateCorrelationId } from '@hutchrok-os/shared';

export interface BeatConfig {
  followUpAfterDays?: number;
  maxFollowUps?: number;
  approvalDigestAfterHours?: number;
}

export interface BeatReport {
  tickAt: string;
  escalatedTasks: number;
  followUpsSent: number;
  approvalsInDigest: number;
  outcomes: ActionOutcome[];
}

export class AutopilotBeat {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastDigestKey = '';

  constructor(
    private readonly engine: AutopilotEngine,
    private readonly store: AutopilotStore,
    private readonly audit: AuditService,
    private readonly config: BeatConfig = {},
    private readonly now: () => Date = () => new Date(),
  ) {}

  start(intervalMs: number): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick().catch((e) => console.error('[autopilot/beat] tick failed:', (e as Error).message));
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<BeatReport> {
    const report: BeatReport = { tickAt: this.now().toISOString(), escalatedTasks: 0, followUpsSent: 0, approvalsInDigest: 0, outcomes: [] };
    if (this.running) return report; // never overlap ticks
    this.running = true;
    const correlationId = generateCorrelationId();

    try {
      await this.slaSweep(report, correlationId);
      await this.followUpSweep(report);
      await this.approvalDigest(report, correlationId);
      await this.audit.record({
        actor: 'site-autopilot',
        actorType: 'SYSTEM',
        actionType: 'autopilot.beat.tick',
        result: 'SUCCESS',
        correlationId,
        source: 'site-autopilot',
        metadata: { escalatedTasks: report.escalatedTasks, followUpsSent: report.followUpsSent, approvalsInDigest: report.approvalsInDigest },
      });
    } finally {
      this.running = false;
    }
    return report;
  }

  private async slaSweep(report: BeatReport, correlationId: string): Promise<void> {
    const nowISO = this.now().toISOString();
    const overdue = (await this.store.listTasks({ status: 'open', limit: 500 })).filter((t) => t.dueAt < nowISO);
    if (overdue.length === 0) return;

    const outcome = await this.engine.notifyTeam(
      renderTeamNotification({
        title: `${overdue.length} autopilot task(s) past SLA`,
        lines: overdue.slice(0, 25).map((t) => [`${t.queue} · ${t.agentId}`, `${t.title} (due ${t.dueAt})`] as [string, string]),
      }),
      correlationId,
    );
    report.outcomes.push(outcome);

    for (const task of overdue) {
      await this.store.saveTask({ ...task, status: 'escalated', escalatedAt: nowISO, updatedAt: nowISO });
    }
    report.escalatedTasks = overdue.length;
  }

  private async followUpSweep(report: BeatReport): Promise<void> {
    const afterMs = (this.config.followUpAfterDays ?? 3) * 86_400_000;
    const max = this.config.maxFollowUps ?? 1;
    const threads = await this.store.listThreads({ status: 'awaiting_customer', limit: 500 });

    for (const thread of threads) {
      if (thread.followUpsSent >= max || !thread.lastOutboundAt) continue;
      if (thread.sensitivity === 'RESTRICTED') continue;
      if (this.now().getTime() - new Date(thread.lastOutboundAt).getTime() < afterMs) continue;
      if (await this.store.isSuppressed(thread.contactEmail)) continue;

      const outcome = await this.engine.sendFollowUp(thread);
      report.outcomes.push({ ...outcome, detail: `follow-up ${threadRef(thread.id)}` });
      if (outcome.status === 'executed') report.followUpsSent += 1;
    }
  }

  private async approvalDigest(report: BeatReport, correlationId: string): Promise<void> {
    const afterMs = (this.config.approvalDigestAfterHours ?? 4) * 3_600_000;
    const pending = (await this.engine.approvals.getPending()).filter(
      (a) => (a.level === 'C' || a.level === 'D') && this.now().getTime() - new Date(a.createdAt).getTime() >= afterMs,
    );
    if (pending.length === 0) return;

    const key = pending.map((a) => a.id).sort().join(',');
    if (key === this.lastDigestKey) return; // only re-send when the set changes
    this.lastDigestKey = key;

    const outcome = await this.engine.notifyTeam(
      renderTeamNotification({
        title: `${pending.length} approval(s) waiting on a human`,
        lines: pending.slice(0, 25).map((a) => [`Level ${a.level} · ${a.entityType}`, `${a.reason ?? ''} — approval ${a.id}`] as [string, string]),
      }),
      correlationId,
    );
    report.outcomes.push(outcome);
    report.approvalsInDigest = pending.length;
  }
}
