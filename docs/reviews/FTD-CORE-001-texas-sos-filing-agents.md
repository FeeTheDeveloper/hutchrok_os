# FTD-CORE-001: Texas SOS filing-agent wiring review

Date: 2026-10-05. Repository: `FeeTheDeveloper/hutchrok_os`. Reviewed HEAD: `44eec7a` on `review/autopilot-approval-boundary`, with local review changes described below. The user-supplied SOSPortal record locator is intentionally not copied into the repository.

Status: **human-handoff preparation only; live portal mutation is blocked**. The linked record currently resolves to the SOSPortal sign-in page. No filing fields, displayed account identity, entity ownership, filing purpose, authorized decision-maker, packet version, or payment authority were verified.

Official sources checked on 2026-10-05:

- Texas SOS Business Filings External User Guide: <https://www.sos.state.tx.us/corp/bf-guide.shtml>
- Texas SOS Form 205 instructions, revised 09/26: <https://www.sos.state.tx.us/corp/instructions/205.shtml>
- Texas SOS business forms index: <https://www.sos.state.tx.us/corp/forms_boc.shtml>

The current guide separates form completion, preview, checkout, payment, and confirmation. Drafts expire after 30 days. Form 205 is only applicable to a Texas LLC formation; the record could instead represent another filing type, so the agent must not infer Form 205 from the link.

## CRITICAL

- The proposed runtime has no durable, tenant-bound filing store, filing-agent consumer, or Texas SOS connector. A browser session would act with the human account's authority while the OS could lose approvals, dedupe state, or audit evidence on restart. No submission-capable connector should be activated.

## HIGH

- The MCP registry previously validated input and invoked handlers without enforcing agent tool access, capabilities, tenant/environment ownership, or approval consumption. The local review patch adds a mandatory authorizer seam and a concrete agent authorizer, but the API composition root still needs to build its call context from authenticated server state and trusted resource lookup.
- Claude's filing approval uses a generated approval entity and mutable metadata rather than binding tenant, case, external record reference, packet digest/version, exact transition, expiry, approver capability, and one-time consumption. It therefore cannot authorize checkout, payment, or submission.
- The filing playbook publishes tasks/events but no worker executes the filing agent or produces the required editable draft, unsigned review copy, evidence map, change log, and submission checklist.

## MEDIUM

- Core case, approval, agent-run, action, event, and audit schemas lack tenant and environment keys. The supplied record must not be introduced into a shared runtime until all reads, writes, indexes, credentials, and audit records are tenant-bound.
- `filing.advance` still returns a placeholder note and does not load the case, verify ownership/version, perform a conditional state transition, persist an audit record, or enqueue an idempotent outbox command.
- The portal record locator is credential-adjacent information. Store a server-side reference or protected secret, not the URL in Git, prompts, agent logs, or approval metadata.

## LOW

- The filing-agent definition still advertises future tools (`filing.validate_requirements`, `filing.request_document`, and `filing.prepare`) that are not registered MCP implementations. Treat those declarations as planned capabilities, not evidence that the workflow is wired.

## TESTS REQUIRED

1. Authenticated principal tests proving request-body identity, role, tenant, environment, and approval claims cannot authorize a call.
2. Cross-tenant and cross-environment resource tests for every filing read, write, document, approval, audit, and connector lookup.
3. Immutable packet tests binding case, record reference, version, digest, action, expiry, and approver capability; edits must invalidate approval.
4. Atomic approval-consumption tests for concurrent clicks, retries, expiry, rejection, and crash recovery.
5. Durable inbox/outbox replay tests before and after every state change and external effect.
6. Portal contract tests that stop before signature, attestation, checkout, payment, or submission and require a human operator for each.
7. Receipt/reconciliation tests that keep prepared, submitted, paid, received, accepted, rejected, and corrected states distinct.

## RECOMMENDED CHANGES

1. Persist a tenant-bound filing work item and evidence map before creating an agent run.
2. Implement the declared validation/preparation tools against a filing domain service; do not let handlers query raw stores or the portal directly.
3. Bind Level C approval to the exact packet digest and requested portal action, then consume it atomically only at the human-operated boundary.
4. Keep portal credentials, MFA, signatures, attestations, payment details, and the final submit action outside agent capability.
5. Add reconciliation that records the human-captured receipt and agency disposition without treating payment or submission as acceptance.

## LOCAL REVIEW PATCH

- `MCPToolRegistry` now requires an injected authorizer before any handler runs.
- `AgentMCPAuthorizer` checks exact tool allowlists, required capabilities, trusted resource scope, and requires an atomic approved-command reservation for protected calls.
- `filing.prepare_portal_handoff` produces a non-submitting, version-bound operator manifest from an opaque record reference; URLs and credentials are rejected by schema.
- The filing agent is explicitly granted the preparation, transition, and approval-request capabilities needed by that boundary.
- No live provider, portal record, credential, payment method, submission, deployment, or production state changed.
