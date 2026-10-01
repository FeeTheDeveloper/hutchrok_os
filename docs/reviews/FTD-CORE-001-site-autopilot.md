# FTD-CORE-001: Hutchrok OS as the site orchestrator

Date: 2026-10-01. Scope: `FeeTheDeveloper/hutchrok_os` and `FeeTheDeveloper/hutchrok_solutions-site` at site commit `1f1d24b`. Hutchrok OS orchestrates site workflows; the site remains authoritative for cases, leads, and payments. This is a secondary engineering review of the existing architecture, not a replacement design.

Status: **local review branch only; production activation is blocked**. The site already emits signed signals, but there is no evidence here that OS credentials, mailbox routing, durable stores, or a deployed OS endpoint are live.

## CRITICAL

- The API currently instantiates in-memory autopilot, approval, audit, and event stores (`apps/api/src/autopilot.ts`). A restart loses thread history, pending human decisions, dedupe keys, suppression state, and audit evidence. The API can acknowledge a signed signal with HTTP 202 before any durable commit. A production startup guard is included in this review branch until durable recovery exists.

## HIGH

- The site bridge (`lib/os/bridge.ts` in the site repo) makes one 3-second delivery attempt and returns `false` on failure. Most callers ignore that result; the notification dispatcher uses `Promise.allSettled`. The site record can therefore commit while the OS never receives the action. Add a transactional site outbox and a lease-based replay worker using the same stable signal ID. Do not mark a signal delivered until the OS has durably accepted it.
- The OS claims a signal or email idempotency key before running its playbook (`packages/autopilot/src/engine.ts`). If a later step fails, a retry is considered a duplicate, so task creation, approval, or notification may be permanently skipped. Persist per-step state and retry failed steps safely.
- The prior approval route accepted `approverUserId` from the request body behind one shared operator bearer key. Anyone holding that key could attribute a Level C/D approval to any person. The review patch requires a separate individual key whose configured hash determines the identity and maximum approval level. A long-term identity provider and capability registry should replace static keys before scale.
- The prior email thread match accepted a copied `Message-ID` without comparing the sender to the thread contact. The review patch enforces the same-contact boundary and adds a regression test.
- The prior event `data` filter removed only a few top-level keys; arbitrary nested client information could enter OS events. The review patch allows only short operational labels and redacts restricted values.
- Approval resolution and outbound send are separate operations. A callback or connector failure after an approval is marked `APPROVED` can strand an unsent draft without an automatic recovery path. Persist an outbound command with a unique idempotency key and reconcile provider status before retrying.

## MEDIUM

- The rate limiter trusts the first `x-forwarded-for` value and stores counters in memory (`apps/api/src/middleware/security.ts`). Require a trusted proxy source and shared limiter for production.
- `SiteSignalSchema.data` accepts arbitrary records without a size or type budget (`packages/autopilot/src/signals.ts`). Define a versioned, per-event contract and reject oversized or unknown fields before processing.
- Signal, approval, and mailbox tables have no tenant or environment key in their current schema. The single Hutchrok deployment can operate as one tenant, but any shared runtime needs tenant-bound keys, queries, credentials, and indexes before another entity is connected.
- The API health `/ready` route reports ready unconditionally (`apps/api/src/routes/health.ts`). It must check database, queue, and connector readiness once persistent adapters exist.

## LOW

- CI preview and production deploy jobs echo placeholder URLs and deployment text (`.github/workflows/ci.yml`). They should not be presented as deployed evidence.
- The site checkout was two commits behind its own `origin/main` at review start; it has been fast-forwarded locally to the already merged signal-bridge commit. No site code change was made in this review branch.

## TESTS REQUIRED

1. Cross-repo contract tests for every emitted signal type, schema version, signature, stable idempotency key, and site-to-OS acknowledgment behavior.
2. Database-backed restart and replay tests: crash before/after each side effect; restore pending approvals, suppression, dedupe, audit, and beat state without duplicate mail.
3. Approval tests for wrong identity, Level C versus D, expired requests, concurrent decisions, edits, connector failure, and audit attribution.
4. Tenant and environment isolation tests before any second entity or production/staging shared deployment.
5. Email threading tests for copied references, changed senders, automated mail, unsubscribe, and stale draft supersession.
6. Delivery tests for OS outage, site timeout, webhook retries, provider `queued` versus delivered, and dead-letter recovery.

## RECOMMENDED CHANGES

1. Keep the site database authoritative for case and payment records. Add a site transactional outbox with a replay worker and a small, versioned signal envelope.
2. Add a persistent OS inbox and workflow store. Atomically accept a signal, record its dedupe key and state, and return 202 only after commit. Use conditional state transitions and transactional outbox entries for external effects.
3. Persist approvals, draft versions, audit records, suppression, and beat scheduling. Bind each approval to a specific immutable draft or case action and verify that binding at execution time.
4. Replace the temporary per-person approval key configuration with authenticated users, explicit approval capabilities, and owner-only Level D policy. Keep all decisions attributable to the verified actor.
5. Add reconciliation and operator recovery views for failed or uncertain sends. Reconcile provider IDs before retrying messages.
6. Enable production only after the above tests pass and the owner reviews the concrete deployment target, credentials, mailbox, rollback, and evidence. Current code intentionally refuses production startup.

Review patch: `review/autopilot-approval-boundary` in `hutchrok_os`. No live provider, site deployment, database, or credential changes were made.
