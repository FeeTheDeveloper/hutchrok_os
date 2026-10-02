# Site Autopilot — Hutchrok OS runs hutchrok.com

Hutchrok OS is the autonomous beat behind **hutchrok.com** (`FeeTheDeveloper/hutchrok_solutions-site`).
Every action on the site and every email to the OS mailbox (**repo_addy@hutchrok.com**) runs
through one governed pipeline in `packages/autopilot`:

```
hutchrok.com action ──signed signal──▶ POST /api/v1/site/signals ─┐
customer email ──Resend / Gmail──▶ POST /webhooks/email/{resend|inbound} ─┤
                                                                          ▼
          dedupe → classify (intent + sensitivity) → playbook → policy → approval
                 → execute (ack · task · draft · notify) → audit → OS event
                                                                          │
          outbound mail FROM + Reply-To repo_addy@hutchrok.com ◀──────────┘
          (every customer reply re-enters the OS and threads onto its case)
```

## What runs automatically vs. what waits for a human

| Action | Level | Behavior |
|---|---|---|
| Classify, route, create task, notify team | A | Automatic |
| Templated acknowledgment / one follow-up | B | Auto-approved by policy (`routine_status_message`, `routine_followup`) |
| Substantive reply (AI or template draft) | **C** | Queued; an operator approves (optionally edits) before it sends |
| Case → `READY_FOR_FILING` | **C** | `filing_submission` approval raised; the OS never submits filings |
| Refunds, payments, money movement | C/D | Never automated — routed to Finance |

Guards: no auto-reply to automated mail (bounces, auto-replies, list mail), internal `hutchrok.com`
senders, or the mailbox itself (loop guard); unsubscribe requests suppress the contact; one
acknowledgment per contact per 24h; replayed signals/emails are ignored (idempotent); a newer customer
message supersedes the stale pending reply draft.

**Data protection:** SSNs, EINs, bank/card numbers, and DD-214 references are detected before anything
else happens. RESTRICTED threads never reach an AI model, bodies are stored and forwarded redacted, and the
acknowledgment asks the customer not to email sensitive data.

## Playbooks (packages/autopilot/src/playbooks.ts)

| Site signal | OS actions |
|---|---|
| `contact.submitted` | Ack · task routed by intent · team notice · reply draft (C) |
| `lead.created` | Welcome email · sales task |
| `intake.submitted` (case created) | Team notice · intake review task *(site already emails the client)* |
| `service_request.submitted` | Ack · launch-services scoping task |
| `federal_intake.submitted` | Ack · govcon review task |
| `case.status_changed` | Operator tasks; `READY_FOR_FILING` → Level C filing approval |
| `document.uploaded` | Filing review task |
| `payment.completed` / `membership.activated` | Team notice · onboarding task |
| `payment.failed` | Team notice · billing task |
| Inbound email | Thread match (`[Ref HRK-…]`, `In-Reply-To`, subject) · ack if new · task · notice · reply draft (C) |

Intents route to the owning agent: filing → `intake`, case status → `customer-service`, billing → `finance`,
membership/marketing/credit → `sales`, VA claims → `compliance`, federal/housing → `govcon`.

## The Beat (packages/autopilot/src/beat.ts)

Every `AUTOPILOT_BEAT_INTERVAL_MS` (default 5 min) the OS sweeps itself:
- **SLA sweep** — overdue tasks escalate to the team inbox.
- **Follow-up sweep** — threads awaiting the customer for `AUTOPILOT_FOLLOWUP_DAYS` get one follow-up.
- **Approval digest** — Level C/D items waiting `AUTOPILOT_DIGEST_HOURS` are summarized (only when the set changes).

## API

| Endpoint | Auth |
|---|---|
| `POST /api/v1/site/signals` | HMAC `x-hutchrok-signature` over `"<x-hutchrok-timestamp>.<body>"` (5-min window), `WEBSITE_INGESTION_SECRET` |
| `POST /webhooks/email/resend` | Svix signature, `RESEND_WEBHOOK_SECRET` |
| `POST /webhooks/email/inbound` | HMAC (same scheme), `EMAIL_INBOUND_SECRET` |
| `GET /api/v1/autopilot/{status,threads,threads/:id,tasks,drafts,approvals}` | `Bearer API_SECRET_KEY` |
| `POST /api/v1/autopilot/approvals/:id/approve` `{ subject?, text? }` | `Bearer API_SECRET_KEY` plus individual `x-hutchrok-approver-key` |
| `POST /api/v1/autopilot/approvals/:id/reject` `{ reason? }` | `Bearer API_SECRET_KEY` plus individual `x-hutchrok-approver-key` |
| `POST /api/v1/autopilot/beat/tick` | `Bearer API_SECRET_KEY` |

All public endpoints are rate limited; ingestion refuses to run (503) until its secret is set.

## Go-live checklist (owner actions)

1. **Mailbox** — create `repo_addy@hutchrok.com` (Google Workspace user/group) or a Resend inbound address.
2. **Outbound** — verify `hutchrok.com` in Resend; set `RESEND_API_KEY` on the OS.
3. **Inbound** — pick one:
   - Resend inbound: webhook → `https://<os-host>/webhooks/email/resend`, set `RESEND_WEBHOOK_SECRET`.
   - Gmail: install `infrastructure/google/os-mailbox-forwarder.gs` on the mailbox, set `EMAIL_INBOUND_SECRET`.
4. **Site → OS** — generate one secret (`openssl rand -hex 32`): OS `WEBSITE_INGESTION_SECRET` = site
   `HUTCHROK_OS_SIGNING_SECRET`; site `HUTCHROK_OS_API_URL=https://<os-host>`.
5. **Replies → OS** — once inbound works, set site `HUTCHROK_OS_MAILBOX=repo_addy@hutchrok.com` so
   client status emails reply into the OS.
6. Set `API_SECRET_KEY` for the operator API. Configure `AUTOPILOT_APPROVERS_JSON` with one entry per human approver: `userId`, SHA-256 hash of an individual random approval key, and `maxLevel` (`C` or owner-only `D`). Give the raw key to that individual through a secret channel. The API derives approval attribution from the key and rejects caller-supplied IDs. Production deploy of the OS requires Level C approval.

## Current limits

- Stores (threads, drafts, tasks, approvals, audit) are **in-memory**: a restart clears them. The Postgres
  tables are defined in `infrastructure/database/schema.ts` (`site_signals`, `email_threads`,
  `email_messages`, `email_drafts`, `autopilot_tasks`, `email_contacts`); the Drizzle-backed
  `AutopilotStore` is the next Phase 2 step and is required before production.
- Command Center UI for the approval queue is not built yet — use the operator API.
