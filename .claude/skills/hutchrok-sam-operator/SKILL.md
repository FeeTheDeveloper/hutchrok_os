---
name: hutchrok-sam-operator
description: Operate SAM.gov workflows for the real Hutchrok legal entity, verify its UEI/CAGE registration, navigate secure Login.gov and entity workspace, prepare registration updates and renewals, and research federal contract opportunities.
---

# Hutchrok SAM.gov operator

Read [organization scope](references/organization-scope.md) before Hutchrok federal tasks. Default to HUTCHROK SOLUTIONS GROUP LLC, UEI PT36H4F81AU9, CAGE 22Z09, unless the task explicitly concerns another entity. Treat supplied registration evidence as a dated snapshot; verify live status before execution. Read hutchrok-sdvosb-contracting for mandatory certification and solicitation shaping. Canonical source: FeeTheDeveloper/hutchrok_os.

## Access, identity and authority

Use https://sam.gov/ as the entry. SAM's [registration guide](https://sam.gov/entity-registration) directs sign-in through Login.gov. Reuse an authorized owner session or protected host authentication; let the owner complete login/MFA when no protected mechanism exists. Never request passwords, codes or recovery keys in chat, extract cookies, or expose credentials to models/logs/Git. SAM login, entity roles and SBA certification access are separate permissions.

Identify task, exact legal entity, UEI/CAGE, user role and intended action. Match the workspace entity; do not create a new entity/UEI just because access is missing. Resolve role/validation problems through official help and authorized processes. Do not change admins, account ownership, login recovery or access grants as a side effect.

Keep banking/tax identifiers, raw veteran records and restricted documents in private protected storage. Models receive only authorized redacted facts, verification outcomes and opaque references. Isolate clients, affiliates and other portfolio companies. Public business identifiers are organization credentials, not authentication secrets.

## Registration maintenance

1. Open the current Entity Workspace using observed labels. Locate the exact entity and inspect registration status, purpose and expiration.
2. Review current official checklist and only the sections relevant to the task: legal identity/address, validation, tax/payment data via protected handling, points of contact, NAICS/size data, assertions and representations/certifications.
3. Use verified source values. Do not infer NAICS, receipts, employee counts, business types or certifications from the company name or SAM active status.
4. Preserve existing record; produce a field-level before/after table, evidence references and exact draft/version for review. Distinguish draft, submitted, pending validation and active.
5. Recheck current renewal requirements; SAM's guide states renewal every 365 days. The supplied PDF lists July 15, 2027 expiration. Reconcile the live account rather than inventing a deadline or creating a scheduled automation from this skill alone.
6. Before submitting, bind applicable human approval to entity, action, draft/version and proposed certifications. Owner/authorized person makes attestations; never fabricate/apply a signature or auto-answer representation questions.
7. Capture real confirmation, status and timestamp/timezone privately. An acknowledgement is not activation. After uncertain outcome, inspect status/history before retrying.

Read CLAUDE.md: enforce Level C human filing approval and Level D owner financial approval where applicable. Retain matching prior authorization; material changes require renewed review. This skill does not activate a connector, renewal job or agency access.

## Contract opportunity research

Use [SAM Contract Opportunities](https://sam.gov/opportunities). Public searches need no login; signed-in functions may support saved searches and following notices. Inspect current controls; search by validated capabilities, relevant NAICS/PSC, agency, location, notice type, set-aside and response dates. Broaden/review results rather than assuming one filter guarantees eligibility.

Open the actual notice, attachments and all amendments. Distinguish sources sought, presolicitation, solicitation, award and sole-source notices. Record opportunity ID, agency, title, notice type, scope, NAICS/PSC, set-aside, deadlines with stated timezone, amendment/version, submission channel and official contact. A sources-sought response is not a priced offer; an award notice is not an open bid.

Run hutchrok-sdvosb-contracting before ranking SDVOSB opportunities or using certification claims. Prepare opportunity register, bid/no-bid brief and compliance matrix. Do not email agencies, join public vendor lists, submit bids or commit pricing without applicable authorization. Follow the solicitation's specified submission destination, not an assumed SAM upload button.

Return actual completed actions, evidence/source dates, pending verification, proposed next action and exact status. Do not claim live access or awards from preparation.
