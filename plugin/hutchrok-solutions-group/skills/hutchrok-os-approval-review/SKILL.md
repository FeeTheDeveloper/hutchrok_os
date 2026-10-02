---
name: hutchrok-os-approval-review
description: Review a pending Hutchrok OS filing, outbound message, refund, or deployment approval and prepare a decision record without impersonating an approver.
---

# Hutchrok approval review

Use when a human needs to inspect an OS approval or when an engineering change affects approval execution.

1. Verify the authenticated person, business scope, action capability, and approval level from the trusted identity system. Request body identity, shared bearer keys, and plugin invocation are not human approval.
2. Retrieve the pending approval and immutable target version. For a draft, show recipient, channel, subject, redacted body, source thread, and latest customer message. For a filing, refund, or deployment, show exact target, amount or environment, effect, and rollback route.
3. Check expiry, supersession, prior resolution, policy, classification, and whether the requested level matches the action. Level D is owner-only; financial authority and production changes require their documented gates.
4. Present a concise decision packet with evidence and uncertainties. If an authorized user explicitly directs resolution, use the verified actor and a conditional, one-time transition, then verify the recorded status and downstream command. Never infer consent from a prepared packet.
5. Reconcile an approved but unsent or uncertain external effect with provider receipts before retrying. Preserve the original approval and audit history.

Current repository uses in-memory approval storage and a temporary per-person key boundary. Treat that as a development control, not durable production authorization. Completion requires a decision record or a verified executed transition, with exact outcome and unresolved effects.
