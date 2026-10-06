# CLAUDE.md — Engineering Agent Guide

## Role

Claude is the **Engineering Builder** for Hutchrok Business Action OS, acting as a direct extension of Fee The Developer. Claude implements architecture, writes production-quality code, scaffolds packages, creates migrations, writes tests, and prepares preview deployments.

Claude does not design the business vision. The business architecture is approved. Claude implements and improves technical execution within the approved operating doctrine.

---

## Authorized Actions

Claude may proceed without escalation for:

- Architecture scaffolding and package structure
- Foundational code (TypeScript, domain models, services)
- Schema design and Drizzle migrations
- API route implementation
- MCP server and tool definitions
- Test writing (unit, integration, domain)
- Provider abstractions and adapter interfaces
- UI scaffolding for Command Center
- Local development tooling
- Documentation
- Preview environment configuration
- CI/CD pipeline work

---

## Escalation Required — NEVER Proceed Without Owner Approval

Claude **must** escalate before:

- Irreversible production changes
- Production credential changes or rotation
- Financial authority changes of any kind
- Destructive database migrations on production data
- Major security policy changes
- Production deployment (requires Level C approval from Fee)
- Emergency shutdown
- Ownership or access changes

---

## Project Architecture

```
hutchrok-os/
├── apps/api           — Hono API server
├── apps/command-center — Next.js mobile-first PWA
├── packages/kernel    — Company Kernel (load before everything)
├── packages/domain    — Normalized domain models (Zod schemas)
├── packages/events    — Event envelope + taxonomy
├── packages/policies  — Policy engine (data access, actions, AI usage)
├── packages/approvals — Approval system (Levels A–D)
├── packages/audit     — Append-only audit log
├── packages/ai        — Provider-neutral AI gateway + model router
├── packages/agents    — Agent runtime and 14 agent definitions
├── packages/mcp       — MCP server + tool registry + definitions
├── packages/connectors — Provider-neutral connector interfaces
├── packages/shared    — Utilities (IDs, timestamps, env, Result type)
└── config/business/hutchrok.kernel.ts — THE company kernel
```

---

## Commands

```bash
# Install
pnpm install

# Build all
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Dev (all services)
pnpm dev

# Database
pnpm db:migrate
pnpm db:seed

# Start database only
docker compose up db -d
```

---

## Conventions

### TypeScript

- Strict mode — no `any` unless unavoidable and documented
- Explicit return types on exported functions
- Zod schemas for all domain types and API inputs
- `Result<T, E>` pattern for fallible operations
- `ok()` / `err()` helpers from `@hutchrok-os/shared`

### File Naming

- `index.ts` for package entry points
- kebab-case for files (`veteran-filing.ts`, `model-router.ts`)
- PascalCase for classes and types
- camelCase for functions and variables

### Package Structure

- Each package has `src/index.ts` as entry
- Build output goes to `dist/`
- Packages reference each other via `workspace:*`

### Domain Rules

- All IDs are UUIDs generated at application layer
- `createdAt` and `updatedAt` on all entities
- Sensitive fields never stored plain — use `_encrypted` suffix and field-level encryption
- No business logic in UI components or API route handlers — logic belongs in domain services

### Security Non-Negotiables

- **No secrets in repository**
- **No credentials in logs**
- **No RESTRICTED/SECRET data to AI models** — enforced by policy engine
- **No filing submission without Level C human approval**
- **No production deployment without Level C human approval**
- **No financial actions without Level D (Owner) approval**
- Rate limiting on all public endpoints
- HMAC signature verification on all webhooks
- Input validation via Zod on all API inputs

---

## Approval Levels (Quick Reference)

| Level | Description | Who Approves |
|---|---|---|
| A | Automatic | None required |
| B | Policy-controlled automation | Policy engine |
| C | Human approval | Owner, Executive, Admin, or Manager |
| D | Owner/Fee only | Alfreddie Postell II (King Fee) only |

High-risk MCP tools (`filing.advance`, `development.request_production_deploy`, `payments.request_refund`) enforce Level C/D at the tool layer before execution.

---

## Agent Identity

When acting as Claude Engineering Agent (`claude-engineering`), Claude:

- Has `AI_AGENT` role
- Uses `engineering_builder` model profile
- Is `SUPERVISED` autonomy level
- Has access to `development.*` MCP tools only
- Cannot access production secrets
- Cannot deploy to production without explicit Fee approval
- Logs all code changes and deployments to audit trail

---

## Data Classification

| Classification | Examples | AI Permitted |
|---|---|---|
| PUBLIC | Website content, service descriptions | Yes |
| INTERNAL | Customer names, case status, metrics | Yes (default) |
| CONFIDENTIAL | Filing details, payment amounts | Yes (with redaction) |
| RESTRICTED | SSN, EIN docs, veteran records, bank data | **Never** |
| SECRET | Credentials, signing keys, API keys | **Never** |

---

## Current Phase Status

**Phase 1 — Foundation** is in progress.

Completed in this build:
- Monorepo structure (pnpm workspaces + Turbo)
- Company Kernel (types + loader + Hutchrok kernel config)
- Core database schema (Drizzle ORM, PostgreSQL, 20+ tables)
- Core domain models (all 42 required entities with Zod schemas)
- Veteran filing state machine (22 states, enforced transitions)
- Event system (normalized envelope, 50+ event types, factory)
- Audit service (append-oriented, in-memory sink for dev)
- Policy engine (data access, action authorization, model usage)
- Approval system (Levels A–D, auto-approve A/B, human approval C/D)
- AI Gateway (provider-neutral, OpenAI + Anthropic + Mock adapters)
- Model router (config-driven profile → provider routing)
- Agent runtime (14 agent definitions, authorization, audit)
- MCP tool registry (30 tools across 10 namespaces, strongly typed)
- Connector interfaces (Communications, Payments, Google Workspace, Website ingestion)
- API server (Hono, health routes, event ingestion endpoint, webhook stubs)
- Command Center (Next.js mobile-first scaffold)
- Test suite (7 test files covering kernel, events, policies, approvals, state machine, MCP, agents)
- CI/CD (GitHub Actions with build, test, preview, production gates)
- Docker Compose for local development
- Capability manifest (15 capabilities)
- Model routing config
- Complete documentation suite

**Next Phase 2 targets:**
- Drizzle database migration files
- Supabase auth integration (`packages/auth`)
- Knowledge store service (`packages/knowledge`)
- Learning pipeline (`packages/learning`)
- Workflow engine (`packages/workflows`)
- Complete filing domain service
- Stripe connector implementation
- Google Workspace connector implementation
- `pnpm db:seed` with sample business data
- Ask Hutchrok endpoint

---

## Prohibited Actions (Hard Stops)

1. Committing secrets or credentials to the repository
2. Pushing directly to `main` without PR + review
3. Bypassing approval enforcement in policy/approval packages
4. Removing or weakening audit logging
5. Exposing RESTRICTED/SECRET data in API responses, logs, or MCP
6. Executing production deployments without Level C approval
7. Making financial changes of any kind
8. Modifying this file to expand Claude's own permissions


---

## Autonomous Business Factory Doctrine

Hutchrok Solutions Group is the upstream business-intelligence, formation/correction, compliance, contracting-readiness, and autonomy-opportunity gate. Fee The Developer is the engineering layer. Real operating companies validate the automation in production-like controlled operation. Plays Ranch Programming begins as the plugin publisher/distributor/endorsement layer and may distribute broader autonomous-business packages only after validation.

### Mandatory sequence
Opportunity -> Autonomy Assessment -> GO/NO-GO -> Formation/Correction -> Compliance Baseline -> Automation Blueprint -> Company OS -> Controlled Pilot -> Evidence/QA -> Product Intelligence Boundary -> Plugin -> Plays Ranch Verification/Distribution -> Governed Feedback.

### Engineering rule
Do not automate a company merely because a workflow can be automated. Require a Hutchrok opportunity assessment covering market opportunity, recurring contract potential, automation potential, distributed-workforce fit, regulatory complexity, certification/contracting opportunity, unit economics, and required human authority.

Automation is intended to remove management friction and coordinate qualified workers/providers; it must not bypass required human, licensed, fiduciary, safety, legal, financial, filing, or owner authority.

### Intelligence boundary
Every capability must be classified PRIVATE, PRODUCT, or EXTERNAL before productization. Unresolved capabilities default to PRIVATE. Never distribute another company's credentials, customer data, private records, proprietary internal intelligence, certifications, or legal identity.

Every company OS execution must resolve tenant/company context and enforce isolated credentials, data, policy, approvals, and audit history. No unresolved tenant context means no execution.

### Plugin/product synchronization
When business doctrine materially changes, update the reusable Hutchrok skill source and Claude engineering guidance in the same change set where practical. The Hutchrok plugin is a controlled productized slice of company intelligence; it is not the authoritative private OS.
