# Texas SOSPortal — Claude engineering handoff

## Objective and source

Make Hutchrok's Texas filing home at https://texas-sos.appiancloud.us/suite/sites/home-page usable through secure, supervised filing operations. Canonical source is FeeTheDeveloper/hutchrok_os. Plugin source is plugin/hutchrok-solutions-group; three matching Claude skills live in .claude/skills. Change both copies together and verify byte equality. This delivery adds instructions and requirements; it does not implement or activate a filing connector.

## Current condition

The owner's 2026-10-05 recording shows the Hutchrok profile and Business Filings dashboard with submissions, cart, drafts, records search and tracker. It does not demonstrate a VVL upload, waiver approval, corrections or successful submission. No recording, account contact details, credentials or veteran records are included in this repository.

The repo contains a veteran filing state machine, approvals, audit and MCP scaffolding. Preserve CLAUDE.md and the production activation gate in docs/reviews/FTD-CORE-001-site-autopilot.md. Do not mistake state transitions or placeholder tool definitions for agency execution.

## Skills and responsibilities

| Skill | Responsibility |
|---|---|
| hutchrok-texas-sos-portal | Secure session, case binding, portal navigation, draft/preview, authorized action and receipt reconciliation |
| hutchrok-texas-vvl-waiver | Entity-specific qualification, secure VVL/Form 05-904 references, fee coverage and portal reconciliation |
| hutchrok-texas-filing-corrections | Draft/received edits, rejected resubmissions, accepted-instrument correction vs later amendment |

ChatGPT handles requirements, review and handoffs. Claude handles future implementation. The owner/authorized person provides signatures, certifications and applicable approvals. A portal operator must have an actually available secure browser capability; skills alone do not provide one.

## Engineering requirements

- Inspect current kernel, data classifications, approvals, audit and filing model before design. Reuse existing controls and UUID identities; keep business logic out of UI/route handlers.
- Bind session/actions to Hutchrok service tenant plus exact client/entity/case. Match entity/file number on every resume and before submission. Keep owner qualification separate from account identity.
- Use protected credential references and human MFA handoff. Do not expose passwords, OTPs, session cookies or raw veteran records to AI models. Restricted uploads require a protected tool path or human operator.
- Persist drafts, reviewed version/hash, private attachment references, fee/waiver decision, approvals, actual tracking number and agency disposition. Store sensitive case evidence outside Git with access control, encryption and retention policy; redact audit events.
- Enforce Level C filing and Level D financial approval. Any authorization must match the action/entity/version/total. Preserve existing approvals when scope still matches; material changes invalidate the review packet.
- Prevent duplicate execution: after timeout/disconnect, reconcile My Submissions/receipt before retrying. Distinguish checkout/payment confirmation from state acceptance. Review cart items individually.
- Preserve original instruments. Use existing formation transitions where valid; define a separate related correction/amendment case in a future reviewed design rather than bypassing terminal states.
- Do not invent Appian private APIs, unattended-login support, waiver controls or new permissions. Use observed UI and current agency instructions.

## Acceptance criteria for future implementation

1. Matching portable/Claude skill contents and discoverable frontmatter; plugin identity, original prompts, assets and audience preserved.
2. A secure authenticated operator can identify the exact entity, prepare a verified draft and produce a review packet without secrets or restricted data reaching logs/models/Git.
3. VVL evidence is checked for the exact entity and owners; each fee has an explicit supported waiver result. An unexpected charge blocks execution and leaves a resumable draft.
4. Rejected resubmission, accepted-instrument correction and later amendment use distinct tested paths. A changed document/fee cannot reuse stale authorization.
5. Wrong tenant/entity, missing approval, expired session and uncertain receipt fail safely. No duplicate submissions on retry; real receipt and acceptance are tracked separately.
6. Owner-controlled live smoke test uses an explicitly chosen case and separately authorized action. No paid searches, filing, signature or payment is part of skill validation.

## Dependencies and decisions needed

Required before live filing: a supported secure browser session, exact case/entity and action, private documents available to authorized operator, verified VVL/Form 05-904 status, current fee/waiver treatment and matching approvals. Decide the private evidence store, operator authentication mechanism, retention policy and future connector implementation with Claude. The exact SOSPortal waiver route and coverage of each correction fee remain unverified; do not assume universal fee relief.

## Official sources checked 2026-10-05

- https://www.sos.state.tx.us/corp/index.shtml — SOSPortal launched September 29, 2026, replacing older filing systems.
- https://www.sos.state.tx.us/corp/bf-guide.shtml — current portal routes, draft retention, submission history and rejected resubmission.
- https://www.sos.texas.gov/corp/veterans.shtml — qualification and VVL/Form 05-904 evidence; legacy SOSUpload reference conflicts with modern portal guidance.
- https://www.sos.state.tx.us/corp/forms/403_boc.pdf — Form 403 revised 09/26; displayed base fee $15, independently subject to waiver verification.

Recheck sources at execution; this record does not establish King Fee's particular entity eligibility or an approved waiver.

## Validation and release record

Plugin candidate version: 1.2.0. Package validation and Claude/portable byte parity passed; original manifest fields/prompts were preserved apart from the requested description extension and version bump. Two builds produced SHA-256 371b652c94f0589ee3af9c546eda35b427fa83df79e30e916a65fbd35a3d31ad. Existing Vitest suite passed: 78 tests across 10 files. Workspace typecheck was attempted but blocked by the environment's pnpm 11 automatic dependency checks/ignored esbuild scripts (repo declares pnpm 9.15.9); it did not reach TypeScript checking. No dependency policy or lockfile was changed.

Scenario review covered an accepted correction with an unexpected $15 charge, a rejected filing from 10 days earlier, and login without secure credential handling. It confirmed pause-on-fee-mismatch, rejected-resubmission routing and human login handoff. Review also flagged a pre-existing mismatch: generic financial agent policy uses Level C while CLAUDE.md requires Level D owner financial approval. Future connector work must enforce the documented Level D requirement and resolve that mismatch before live financial execution. No live SOS login, VVL upload, waiver acceptance, filing, payment or signature was performed.
