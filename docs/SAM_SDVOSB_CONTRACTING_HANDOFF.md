# SAM.gov and SDVOSB contracting — Claude handoff

## Objective

Make Hutchrok's real federal organization identity mandatory in SAM and SDVOSB procurement workflows. Extend the existing Texas agency skills with SAM maintenance, SBA certification evidence, opportunity research, compliance matrices and factual offer preparation. ChatGPT handles requirements/QA; Claude handles future implementation in FeeTheDeveloper/hutchrok_os.

## Documented organization scope

Owner-uploaded EntityInformation_20261005-175853.pdf, page 1, generated October 5, 2026 at 22:59:03 GMT, shows HUTCHROK SOLUTIONS GROUP LLC, UEI PT36H4F81AU9, CAGE 22Z09, Active Registration, All Awards, and July 15, 2027 expiration. The public identifier snapshot is in the SAM skill's references/organization-scope.md, with source hash and evidence limits. No raw PDF, exact address, login secrets, veteran/VA documents or bank/tax records are committed.

This update is grounded in a real organization. The PDF does not establish live registration today, ownership/control, NAICS/size facts, SAM user roles, award history or SBA SDVOSB certification. Owner-provided service-disabled veteran status is recorded separately from verified agency certification. Missing evidence is UNVERIFIED, not a declaration of ineligibility.

## Shared skills

| Skill | Responsibility |
|---|---|
| hutchrok-sam-operator | Identity binding, secure Login.gov/SAM account use, workspace maintenance, renewal review and opportunity research |
| hutchrok-sdvosb-contracting | Mandatory readiness gates, separate SBA certification workflow, compliance matrices, bid/no-bid and proposal handoffs |

Portable skills live under plugin/hutchrok-solutions-group/skills; matching Claude skills live under .claude/skills. Keep skill bodies and SAM organization reference byte-identical. Existing contracting/certification skills and command routing point to these procedures. Plugin version becomes 1.3.0, preserving previous Texas workflows, prompts, identity and audience.

## Current condition and dependencies

The plugin remains skills-only. No signed-in SAM/SBA session, live entity search, certification decision, opportunity, actual solicitation or private eligibility record was inspected in this update. No connector, background renewal process or bid submission capability is activated. Prior OS production gates and financial-policy mismatch remain unresolved.

Live work needs a secure owner-authorized session with the appropriate entity role, current exact-entity record, genuine certification evidence, validated capabilities/NAICS/size facts, chosen solicitation/version and action-specific approvals. Existing UEI must be reused; missing workspace access must not cause duplicate registration. Restricted document handling requires a protected tool path or owner operation.

## Engineering requirements

- Bind Hutchrok tenant, exact entity/UEI/CAGE, agency, session role, task and procurement record. Separate Login.gov authentication, SAM roles, SBA certification, Texas VVL and client identities.
- Provide reviewed organization evidence with provenance, checked time and stale/conflict handling; do not let a historical PDF silently become perpetual live status.
- Maintain separate registration, certification and bid-readiness status. Any missing certification evidence must block unsupported SDVOSB claims while allowing research and draft preparation.
- Use protected credentials/MFA and upload handling. Never send secrets or raw restricted records to models. Store private evidence and redacted audit records outside Git.
- Model opportunity ID, notice type, amendments, deadline/timezone, NAICS/PSC, set-aside, actual submission channel, compliance rows, evidence, draft/version and approval. Test data must be explicit and isolated from live business records.
- Preserve approved agency originals and application answers. Human authorized representatives provide signatures/attestations. Level C submission and Level D financial/pricing commitment controls apply; do not expand Claude's engineering identity permissions.
- Reconcile actual status/receipts before retrying uncertain submissions; record acknowledgement and acceptance/certification/award separately. Never fabricate success.
- Use supported host tools or documented public data APIs only after actual capability verification. No invented SAM private endpoint, autonomous Login.gov flow or agency account permission.

## Acceptance criteria

1. All Hutchrok federal tasks default to the documented legal entity and identifiers, with alternate clients separately bound.
2. The PDF yields a dated active SAM snapshot; it cannot establish SDVOSB certification, current access or an award.
3. Secure login fallback and missing entity-role handling do not expose credentials or create duplicate entities.
4. Mandatory readiness worksheet covers registration, certification, solicitation size/eligibility, capabilities, amendments, deadlines and authority.
5. Sources-sought research, priced offers, SBA applications and agency messages have distinct action scopes and matching approvals.
6. A capability statement contains supported claims only; Texas VVL and portfolio ownership cannot transfer federal certification.
7. Skill/reference parity, package validation, original manifest preservation and published source read-back pass; live account behavior remains separately unverified.

## Official references checked October 5, 2026

- https://sam.gov/entity-registration — entity registration, Login.gov and renewal guidance.
- https://sam.gov/entity-information — entity status/search entry.
- https://sam.gov/opportunities — procurement notices, search and account features.
- https://www.sba.gov/veterans/ — current certification and eligibility guidance.
- https://certifications.sba.gov/ — current SBA certification entry reached through the official SBA link.

Recheck applicable program rules and each actual solicitation before execution. The next implementation decision is the protected operator/connector mechanism, not changing documented business identity.
