export type ControlStatus = 'ready' | 'guarded' | 'blocked' | 'unavailable';

export interface ControlStage {
  name: string;
  detail: string;
  status: ControlStatus;
}

export const controlStages: readonly ControlStage[] = [
  { name: 'Intake', detail: 'Signed signal boundary', status: 'guarded' },
  { name: 'Policy', detail: 'Risk and action rules', status: 'guarded' },
  { name: 'Approval', detail: 'Verified human identity', status: 'guarded' },
  { name: 'Effect', detail: 'Provider dispatch', status: 'unavailable' },
  { name: 'Audit', detail: 'Durable evidence', status: 'blocked' },
];

export const readinessSummary = {
  productionBlocked: true,
  reason: 'Durable state, replay, and provider reconciliation are not implemented.',
} as const;

export const attentionItems = [
  { severity: 'critical', area: 'Persistence', owner: 'Platform', title: 'Workflow state is memory-only', detail: 'A restart can erase approvals, dedupe keys, thread history, and audit evidence.' },
  { severity: 'high', area: 'Delivery', owner: 'Integrations', title: 'No transactional outbox or replay', detail: 'A site record can commit while the OS never receives or completes the signal.' },
  { severity: 'high', area: 'Isolation', owner: 'Security', title: 'Tenant and environment keys are incomplete', detail: 'Shared runtime operation is unsafe until every record and credential is tenant-bound.' },
] as const;

export const domainReadiness = [
  { name: 'Site signals', status: 'guarded' },
  { name: 'Approval identity', status: 'guarded' },
  { name: 'Outbound email', status: 'unavailable' },
  { name: 'Payments', status: 'unavailable' },
  { name: 'Government filing', status: 'blocked' },
] as const satisfies readonly { name: string; status: ControlStatus }[];

export const recoveryItems = [
  { title: 'Durable inbox', detail: 'Atomically accept and resume signals.', status: 'blocked' },
  { title: 'Step replay', detail: 'Retry incomplete work without duplicate effects.', status: 'blocked' },
  { title: 'Approval binding', detail: 'Bind decisions to immutable action versions.', status: 'guarded' },
  { title: 'Provider reconcile', detail: 'Resolve uncertain delivery before retry.', status: 'unavailable' },
] as const satisfies readonly { title: string; detail: string; status: ControlStatus }[];
