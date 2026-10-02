---
name: hutchrok-os-control-review
description: Review a Hutchrok OS control-plane change for tenant isolation, authorization, approvals, connector safety, audit, idempotency, recovery, and tests before activation.
---

# Hutchrok OS control review

Use this for engineering review of the Hutchrok OS repository or a proposed architecture. Identify the exact repository, branch, commit, changed files, and runtime status. Treat code and executed tests as evidence; docs and MCP tool definitions may describe planned behavior.

1. Trace each entry point through identity verification, business or tenant binding, capability checks, policy evaluation, approval, external effect, audit, and recovery. Inspect actual call paths, not just interfaces.
2. Check all reads and writes for tenant-scoped queries and ownership validation. An ID, business alias, role string, or request body field is not authority by itself.
3. Check credential boundaries: inbound signatures, key scope, connector account binding, secret handling, model redaction, and whether a tool or webhook can act as a human.
4. Check retries and concurrent execution: atomic dedupe, approval consumption, draft version binding, transactional outbox, provider idempotency, failure reconciliation, and rollback.
5. Classify material findings as CRITICAL, HIGH, MEDIUM, or LOW. Cite file and line evidence, exploit path or failure sequence, impact, and the smallest corrective change. Distinguish demonstrated defects from design risks.
6. List TESTS REQUIRED and RECOMMENDED CHANGES. Prepare isolated fixes on a review branch when the user requests implementation. Run relevant tests and review the diff.

Current repository review note: `docs/reviews/FTD-CORE-001-site-autopilot.md`. Its findings are a dated baseline; verify the current code before repeating them. The in-memory autopilot and stub MCP handlers must never be described as production-ready controls.

Completion: provide the requested severity sections, tests executed and missing, exact branch/commit, and whether any live provider or production state changed.
