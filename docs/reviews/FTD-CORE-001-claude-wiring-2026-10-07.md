# FTD-CORE-001 secondary review: Claude wiring

Reviewed branch `review/autopilot-approval-boundary`, Claude commit `7b84325ace095e5c07a99585f8dc4ddb8b95f99a`, on 2026-10-07. The review is repository-only. No provider, deployment, database, credential, filing, or production state was changed.

## CRITICAL

None demonstrated in the current production-blocked runtime.

## HIGH

### H1 — approval is consumed before the external effect is recoverable

`ApprovalService.approve()` atomically changes an approval to `APPROVED`, then invokes the callback (`packages/approvals/src/index.ts:91-103`). The callback fetches the current mutable draft and immediately dispatches it (`packages/autopilot/src/engine.ts:717-737`). Provider send happens before the final draft, thread, audit, and event writes (`packages/autopilot/src/engine.ts:752-825`). A crash or database failure after approval consumption can leave an approved action stranded or externally sent with incomplete local evidence. There is no transactional outbox, execution lease, retry state, or provider-status reconciliation.

Smallest corrective direction: keep the human decision immutable, create a tenant-bound execution intent/outbox row in the same transaction, and have a retriable worker dispatch and reconcile the provider effect using a stable provider idempotency key.

### H2 — approvals and the autopilot record set are not tenant-bound

The `approvals`, `email_threads`, `email_messages`, `email_drafts`, `autopilot_tasks`, `email_contacts`, and `audit_logs` tables have no tenant/company key (`infrastructure/database/schema.ts:288-307`, `351-372`, `565-643`). Store reads are global by raw ID, status, queue, or email (`infrastructure/stores/approvals.ts:82-100`; `infrastructure/stores/autopilot.ts:323-345`, `373-425`). The operator routes likewise take raw IDs and return global lists (`apps/api/src/routes/autopilot.ts:42-118`). A future shared runtime or misbound operator credential would cross business boundaries.

Smallest corrective direction: add non-null tenant/company columns, tenant-inclusive keys and indexes, bind the store instance to a trusted server-derived tenant context, and remove unscoped read/write methods.

### H3 — durable events can still lose or bypass tenant binding

The event table allows nullable tenant/company/channel fields (`infrastructure/database/schema.ts:332-342`). The autopilot creates plain events with `createEvent()` rather than tenant-bound `createActivity()` (`packages/autopilot/src/engine.ts:294-305`, `719-729`, `814-824`). `PgEventStore.findById()`, `byCorrelation()`, `query({})`, and `count()` permit unscoped reads (`infrastructure/stores/events.ts:140-179`). Persistence is durable, but the trail is not reliably tenant-isolated.

Smallest corrective direction: require `ActivityEnvelope` at external-ingestion and consequential-effect boundaries, make tenant/company non-null for those rows, and require tenant scope in every operator query.

### H4 — the legacy website event endpoint acknowledges dropped work

`POST /api/v1/events/website` verifies signatures only in staging/production, creates an in-memory event, logs it, and returns `201` without persistence or processing (`apps/api/src/routes/events.ts:38-78`). Production startup is blocked today, but local/dev callers receive a false success and a future unblocking would expose a second, weaker ingestion contract beside `/api/v1/site/signals`.

Smallest corrective direction: remove or return fail-closed status from the legacy route, or route it through the same signed, tenant-bound receipt and workflow path as `/api/v1/site/signals`.

## MEDIUM

### M1 — approvals are not bound to immutable content or destination

Approval metadata records IDs and labels, not a tenant, environment, recipient, subject/body digest, connector/account binding, or action version (`packages/autopilot/src/engine.ts:649-677`). `saveDraft()` can overwrite recipient-adjacent content after the approval request (`infrastructure/stores/autopilot.ts:294-320`), and approval dispatch rereads the current draft. A decision can therefore authorize a different payload from the one reviewed.

### M2 — connector declarations can be mistaken for runtime enablement

The kernel uses `enabled: true` for external providers even when local credentials and account ownership are absent. The command center now labels this explicitly as “enabled in kernel,” separates local configuration presence, and reserves live verification for account-bound evidence. Stripe mode was changed from `live` to `live-when-verified`.

### M3 — the command center has no authentication boundary

The surface is safe while bound to loopback and shows no secret values. If deployed or populated with tenant data, it needs server-side authentication, tenant authorization, cache controls, and security headers before exposure.

## LOW

- Audit and event retention/export policies remain undefined and storage is unbounded.
- `apps/api/src/autopilot.ts` and the production-startup comments were stale after Postgres adapters landed; this review corrected the comments without changing the production block.
- The accepted formation record and business phone remain unresolved. The kernel now uses only the current public contact address/email and Central Time; the public address is explicitly not treated as registered-agent authority.

## TESTS REQUIRED

- Crash at each boundary: after approval consumption, after provider acceptance, after draft update, after audit append, and after event append; prove deterministic recovery without duplicate sends.
- Change draft recipient, subject, or body after approval request; dispatch must reject digest/version mismatch.
- Two-tenant tests for every approval, audit, thread, draft, task, contact, event, and receipt read/write path; raw IDs from tenant A must not work in tenant B.
- Wrong-account connector tests for Stripe, Resend, Google Workspace, and GitHub; valid credentials for the wrong account must fail the binding check.
- Legacy `/api/v1/events/website` tests must prove unsigned input is rejected in every environment and accepted input is durably processed or explicitly refused.
- Concurrent approval and provider-retry tests with stable execution idempotency keys.
- Command-center tests for missing config, config-present-but-unverified, live-verified receipt, mobile layout, keyboard navigation, and unauthorized remote access.

## RECOMMENDED CHANGES

1. Land tenant-bound immutable execution intent and transactional outbox before enabling any external effect.
2. Add tenant/company keys to approvals, audit, and all autopilot tables; make tenant scope mandatory in store constructors and queries.
3. Bind approvals to tenant, environment, capability, connector account, destination, action version, and payload digest.
4. Consolidate website ingestion onto one signed, durable endpoint and retire the false-success legacy route.
5. Add provider reconciliation and an operator-visible recovery queue.
6. Keep the command center read-only and loopback-only until server authentication and tenant authorization exist.

## Verification completed

- `corepack pnpm test` — 17 files, 244 tests passed.
- `corepack pnpm --filter @hutchrok-os/command-center typecheck` — passed.
- `corepack pnpm --filter @hutchrok-os/command-center build` — passed.
- Browser review at `http://127.0.0.1:3020` — dashboard and connection board rendered; no console warnings or errors.
- `git diff --check` — passed.
