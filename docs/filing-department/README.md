# Texas Filing Department Workspace

This workspace prepares Texas Secretary of State and Comptroller corrections for human review. It does not authorize portal submission, certification, signature, attestation, payment, or a change to any live record.

## Current readiness

- The Texas SOSPortal has been reached through the Hutchrok browser profile and currently requires the authorized user to complete Secure Access login and multifactor authentication.
- No source filing, accepted instrument, rejection notice, Comptroller report, entity file number, address evidence, or signer authority is stored in this repository.
- A correction must remain `BLOCKED_MISSING_SOURCE` until the source record and supporting evidence are available.
- Restricted working material belongs under `filing-workspace/private/`, which is ignored by Git. Sanitized templates and procedures belong under this directory.

## Required case artifacts

Each case must have a unique opaque case ID and the following versioned artifacts:

1. An immutable copy of the source record or portal preview.
2. A source inventory identifying the agency, entity, filing type, filing date, and state file number.
3. A field change table showing each current value, proposed value, reason, and evidence reference.
4. A form-routing decision with the official source and the date checked.
5. An editable working draft and a clean unsigned review copy.
6. An evidence map and unresolved-issue list.
7. A reviewer decision tied to the exact packet version and digest.
8. A human submission checklist that stops before signature, attestation, checkout, payment, or submission.
9. After human submission, a receipt and agency disposition recorded as separate events.

## Status vocabulary

Use one status only:

- `BLOCKED_MISSING_SOURCE`
- `INTAKE_COMPLETE`
- `ROUTING_REVIEW`
- `DRAFT_PREPARED`
- `INTERNAL_REVIEW`
- `AWAITING_AUTHORIZED_SIGNATURE`
- `READY_FOR_HUMAN_SUBMISSION`
- `HUMAN_SUBMITTED`
- `AGENCY_RECEIVED`
- `AGENCY_ACCEPTED`
- `AGENCY_REJECTED`
- `CORRECTION_REQUIRED`
- `CLOSED`

`READY_FOR_HUMAN_SUBMISSION` is not evidence that a filing was submitted, paid, received, or accepted.

## Case setup

1. Copy `TEXAS_FILING_CASE_TEMPLATE.md` to the restricted case folder.
2. Assign a non-identifying case ID. Do not use an entity name, taxpayer number, address, portal URL, or veteran verification code in the folder name.
3. Copy source files without modifying them and record a SHA-256 digest for each.
4. Complete the field change table before selecting a form.
5. Apply `FORM_ROUTING.md` and record the official instruction page checked.
6. Prepare the draft with `Texas Filing Correction Preparation Workbook.docx`.
7. Run the readiness checklist. Any unresolved material field keeps the packet blocked.

## Boundary between agencies

Secretary of State entity records and Comptroller franchise-tax reports are separate systems. A field is never treated as synchronized merely because it matches in a draft. Use `../TEXAS_COMPTROLLER_HANDOFF.md` to decide whether a separate Comptroller action is required.
