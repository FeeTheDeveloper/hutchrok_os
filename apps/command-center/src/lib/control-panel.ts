import { hutchrokKernel } from '@hutchrok-os/config/kernel';

export type ControlStatus = 'ready' | 'guarded' | 'blocked' | 'unavailable';

export interface ControlStage {
  name: string;
  detail: string;
  status: ControlStatus;
}

export interface ConnectionReadiness {
  id: string;
  name: string;
  configuredInKernel: boolean;
  status: ControlStatus;
  stateLabel: string;
  detail: string;
  needed: string;
}

type Environment = Readonly<Record<string, string | undefined>>;

function hasValue(env: Environment, key: string): boolean {
  const value = env[key]?.trim();
  if (!value) return false;
  return !/^<.*>$/.test(value) && value !== '[]';
}

function hasAll(env: Environment, keys: readonly string[]): boolean {
  return keys.every((key) => hasValue(env, key));
}

function connection(
  input: Omit<ConnectionReadiness, 'status' | 'stateLabel'> & { credentialsPresent: boolean },
): ConnectionReadiness {
  return {
    id: input.id,
    name: input.name,
    configuredInKernel: input.configuredInKernel,
    status: input.credentialsPresent ? 'guarded' : 'unavailable',
    stateLabel: input.credentialsPresent ? 'Config present / verify live' : 'Connection needed',
    detail: input.detail,
    needed: input.needed,
  };
}

/**
 * Reports presence only. Environment values never leave the server and never
 * count as proof that an account, tenant, webhook, or provider is live.
 */
export function buildConnectionReadiness(env: Environment): readonly ConnectionReadiness[] {
  const connectors = hutchrokKernel.connectors;
  const communicationsProvider = env['COMMS_PROVIDER']?.trim().toLowerCase();
  const communicationsPresent =
    communicationsProvider === 'twilio'
      ? hasAll(env, ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'])
      : communicationsProvider === 'telnyx'
        ? hasAll(env, ['TELNYX_API_KEY', 'TELNYX_PHONE_NUMBER'])
        : false;
  const inboundEmailPresent =
    hasValue(env, 'RESEND_WEBHOOK_SECRET') || hasValue(env, 'EMAIL_INBOUND_SECRET');

  return [
    connection({
      id: 'database',
      name: 'PostgreSQL control store',
      configuredInKernel: true,
      credentialsPresent: hasValue(env, 'DATABASE_URL'),
      detail: 'Durable workflow, approval, receipt, audit, and event adapters are implemented.',
      needed: 'DATABASE_URL plus migration and restart-recovery verification',
    }),
    connection({
      id: 'site-bridge',
      name: 'hutchrok.com signal bridge',
      configuredInKernel: connectors['website']?.enabled === true,
      credentialsPresent: hasValue(env, 'WEBSITE_INGESTION_SECRET'),
      detail: 'The API accepts signed site signals; the live site pairing is not verified here.',
      needed: 'Matching signing secret on the site and OS, then a signed canary receipt',
    }),
    connection({
      id: 'approvals',
      name: 'Human approval roster',
      configuredInKernel: true,
      credentialsPresent: hasValue(env, 'AUTOPILOT_APPROVERS_JSON'),
      detail: 'Approval keys are hashed and decisions are conditionally consumed once.',
      needed: 'Named approver entries, secure key delivery, expiry and immutable action binding',
    }),
    connection({
      id: 'outbound-email',
      name: 'Outbound email',
      configuredInKernel: connectors['osMailbox']?.enabled === true,
      credentialsPresent: hasValue(env, 'RESEND_API_KEY'),
      detail: 'Without a Resend key the runtime intentionally uses a non-delivering mock.',
      needed: 'Verified sending domain, scoped Resend key, and provider reconciliation',
    }),
    connection({
      id: 'inbound-email',
      name: 'Inbound email',
      configuredInKernel: connectors['osMailbox']?.enabled === true,
      credentialsPresent: inboundEmailPresent,
      detail: 'Resend and Google Apps Script webhook routes exist, but neither is proven live.',
      needed: 'One signed inbound route, mailbox ownership check, and replay test',
    }),
    connection({
      id: 'google-workspace',
      name: 'Google Workspace',
      configuredInKernel: connectors['googleWorkspace']?.enabled === true,
      credentialsPresent: hasAll(env, [
        'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
      ]),
      detail: 'The kernel declares the hutchrok.com domain; account scope is not verified.',
      needed: 'Scoped service account, delegated-authority review, and displayed-domain check',
    }),
    connection({
      id: 'stripe',
      name: 'Stripe',
      configuredInKernel: connectors['stripe']?.enabled === true,
      credentialsPresent: hasAll(env, ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']),
      detail: 'Payment schemas and webhook boundaries exist; no live account is verified.',
      needed: 'Correct account, restricted key, signed webhook, idempotency and refund controls',
    }),
    connection({
      id: 'github',
      name: 'GitHub App',
      configuredInKernel: connectors['github']?.enabled === true,
      credentialsPresent: hasAll(env, [
        'GITHUB_APP_ID',
        'GITHUB_APP_PRIVATE_KEY',
        'GITHUB_WEBHOOK_SECRET',
      ]),
      detail: 'Repository identity is declared; app installation and permissions are unverified.',
      needed: 'App installation, repository allowlist, minimum permissions, and webhook receipt',
    }),
    connection({
      id: 'communications',
      name: 'SMS / voice provider',
      configuredInKernel: connectors['communications']?.enabled === true,
      credentialsPresent: communicationsPresent,
      detail: 'The provider choice is still unresolved; mock mode is not a live connection.',
      needed: 'Choose Twilio or Telnyx, verify the number, scope credentials, and test opt-out',
    }),
  ];
}

export function buildControlStages(env: Environment): readonly ControlStage[] {
  return [
    { name: 'Intake', detail: 'Signed signal boundary', status: 'guarded' },
    { name: 'Policy', detail: 'Risk and action rules', status: 'guarded' },
    { name: 'Approval', detail: 'Verified human identity', status: 'guarded' },
    { name: 'Effect', detail: 'Provider dispatch', status: 'unavailable' },
    {
      name: 'Audit',
      detail: hasValue(env, 'DATABASE_URL') ? 'Durable adapter configured' : 'In-memory fallback active',
      status: hasValue(env, 'DATABASE_URL') ? 'guarded' : 'blocked',
    },
  ];
}

export const businessIdentity = {
  legalName: hutchrokKernel.identity.legalName,
  publicEmail: hutchrokKernel.contact.emailPrimary,
  publicAddress: hutchrokKernel.contact.address,
  timezone: hutchrokKernel.identity.timezone,
  source: 'Current public site + repository kernel · checked 2026-10-07',
} as const;

export const readinessSummary = {
  productionBlocked: true,
  reason: 'Durable adapters now exist, but provider recovery, immutable approval binding, and complete tenant scoping remain open.',
} as const;

export const attentionItems = [
  { severity: 'critical', area: 'Approval', owner: 'Platform', title: 'Approved effects can be stranded', detail: 'Approval is consumed before email dispatch; a crash can leave an approved action neither sent nor safely retryable.' },
  { severity: 'high', area: 'Isolation', owner: 'Security', title: 'Autopilot and audit rows are not tenant-bound', detail: 'Approvals, audit entries, drafts, threads, tasks, and contacts have no tenant key or mandatory scoped reads.' },
  { severity: 'high', area: 'Recovery', owner: 'Integrations', title: 'No transactional outbox or provider reconcile', detail: 'Database state and external effects are not committed as one recoverable workflow.' },
] as const;

export const domainReadiness = [
  { name: 'Durable adapters', status: 'ready' },
  { name: 'Signed site intake', status: 'guarded' },
  { name: 'Approval identity', status: 'guarded' },
  { name: 'Provider effects', status: 'unavailable' },
  { name: 'Government filing', status: 'blocked' },
] as const satisfies readonly { name: string; status: ControlStatus }[];

export const recoveryItems = [
  { title: 'Durable stores', detail: 'Postgres adapters cover the current workflow, approvals, receipts, audit, and events.', status: 'ready' },
  { title: 'Step replay', detail: 'Retry incomplete work without duplicate effects.', status: 'blocked' },
  { title: 'Approval binding', detail: 'Bind decisions to immutable tenant, action, destination, and content digests.', status: 'blocked' },
  { title: 'Provider reconcile', detail: 'Resolve uncertain delivery before retry.', status: 'unavailable' },
] as const satisfies readonly { title: string; detail: string; status: ControlStatus }[];
