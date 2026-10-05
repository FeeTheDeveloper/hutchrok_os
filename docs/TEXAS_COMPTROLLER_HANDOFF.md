# Texas Comptroller — Claude handoff

## Objective

Extend Hutchrok's existing SOS filing skills with a separate Comptroller account and report workflow. Preserve https://texas-sos.appiancloud.us/suite/sites/home-page as the SOS home; use https://comptroller.texas.gov/taxes/file-pay/ for the official eSystems/Webfile login link. Canonical repo: FeeTheDeveloper/hutchrok_os.

## Current condition

SOS skills from PR #5 are merged. The private plugin is being advanced from 1.2.0 to 1.2.1. The repo contains skills and OS scaffolding; neither agency has a live connector activated by this change. No Comptroller session, taxpayer account, VVL contents, qualification decision or tax return has been inspected live.

## Shared source and duties

Portable source: plugin/hutchrok-solutions-group/skills/hutchrok-texas-comptroller/SKILL.md. Claude source: .claude/skills/hutchrok-texas-comptroller/SKILL.md. Keep both byte-identical; existing VVL skills now route tax questions here. ChatGPT provides requirements and QA; Claude implements future adapters and workflow changes.

## Requirements for future implementation

- Separate SOS and Comptroller credential references/session scopes; bind Hutchrok tenant plus client/entity and private taxpayer reference, tax type and report year. No cross-company credential reuse.
- Use protected login/MFA and protected document uploads. Credentials, Webfile access numbers, bank details and raw veteran records must not enter AI context, logs or this public repo.
- Track qualification as unverified/pending/agency-verified/expired-or-lost with evidence references; these are design requirements, not implemented enum values. Keep qualification, reporting obligations, filing receipts and agency disposition distinct.
- Determine report duties by current authority, report year and continuing qualification; do not equate ordinary no-tax-due status with qualifying veteran treatment.
- Preserve originals and prepare versioned correction packets. Select SOS correction, amended PIR, amended OIR or tax-report amendment based on the actual record and action. Do not assume an online amendment or VVL upload exists.
- Enforce CLAUDE.md: Level C filings and Level D owner financial approval, bound to entity/action/version/period/amount. Preserve its existing permissions; resolve the previously recorded financial-policy mismatch before live payments.
- Reconcile actual account history after uncertain execution, preventing duplicates. Tax actions need separate linked case records rather than unrelated formation-state transitions.

## Acceptance criteria

1. Correct agency selection when the owner calls the Appian SOS URL a Comptroller URL.
2. Secure account/entity/period binding before edits, with human login fallback.
3. Qualified veteran vs ordinary no-tax-due vs pending qualification produce separate, supported report-year decisions.
4. Registered-agent changes route to SOS; PIR correction follows current Comptroller instructions; other reports use their own amendment guidance.
5. No submission, payment, signature, notification or account-linking without matching authority; no claim of live execution based on a draft or placeholder tool.
6. Claude/portable skill parity, preserved plugin identity/prompts/assets, package validation and guarded release/read-back pass.

## Dependencies and unresolved decisions

Need exact entity/taxpayer account, report year and intended action for live work; secure sessions, owner-authorized records, agency-verification evidence and applicable approvals. Claude must select a protected browser/connector mechanism and private evidence store. Specific account qualification, notices, waiver coverage and online amendment availability remain unverified. This handoff does not implement tax calculations or activate accounts.

## Official sources checked 2026-10-05

- https://comptroller.texas.gov/taxes/file-pay/ — separate eSystems/Webfile entry.
- https://comptroller.texas.gov/taxes/franchise/veteran-business.php — veteran qualification, Form 05-904 and entity-specific submission routes; distinguishes historical reports from current reporting relief.
- https://comptroller.texas.gov/taxes/franchise/pir-oir-filing-req.php — reporting exceptions, amended PIR handling and registered-agent changes at SOS.

Recheck at execution. No secrets, completed forms, veteran documents or recording copies are included.
