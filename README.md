# Hutchrok Business Action OS

**Hutchrok Solutions Group LLC** | Engineering Authority: Fee The Developer

> The first production-grade Business Action OS — a custom operational runtime that receives signals from Hutchrok's website, apps, communications, payments, Workspace, social platforms, and connected services, then normalizes, routes, and executes business actions with full audit and approval governance.

---

## What This Is

Hutchrok OS is **not** a generic CRM, dashboard, chatbot, or workflow app.

It is the operating system for Hutchrok Solutions Group LLC — purpose-built to run the business, execute actions, enforce policy, invoke AI, maintain audit history, and continuously learn from operations.

The Hutchrok implementation is **custom**. The reusable infrastructure is the **platform**.

---

## Quick Start (Local)

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- PostgreSQL (or use Docker)

### Setup

```bash
# Clone
git clone https://github.com/FeeTheDeveloper/hutchrok_os.git
cd hutchrok_os

# Install
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your values

# Start database
docker compose up db -d

# Run migrations
pnpm db:migrate

# Seed development data
pnpm db:seed

# Start all services
pnpm dev
```

### Services

| Service | URL |
|---|---|
| API | http://localhost:3001 |
| Command Center | http://localhost:3000 |
| API Health | http://localhost:3001/health |

---

## Monorepo Structure

```
hutchrok-os/
├── apps/
│   ├── api/               — Core API server (Hono / Node.js)
│   ├── command-center/    — Mobile-first Command Center (Next.js)
│   └── mobile/            — (future native mobile)
│
├── packages/
│   ├── kernel/            — Company Kernel types and loader
│   ├── domain/            — Core domain models and schemas
│   ├── events/            — Event envelope and taxonomy
│   ├── workflows/         — Workflow engine primitives
│   ├── policies/          — Policy engine
│   ├── approvals/         — Approval system (Levels A–D)
│   ├── auth/              — Authentication (Supabase)
│   ├── audit/             — Append-oriented audit logging
│   ├── ai/                — Provider-neutral AI gateway + model router
│   ├── agents/            — Agent runtime and definitions
│   ├── knowledge/         — Knowledge store
│   ├── learning/          — Learning pipeline
│   ├── analytics/         — Analytics layer
│   ├── mcp/               — MCP server and tool definitions
│   ├── connectors/        — Provider-neutral connector interfaces
│   └── shared/            — Shared utilities
│
├── config/
│   ├── business/          — Hutchrok Company Kernel
│   ├── capabilities/      — Capability manifest
│   ├── agents/            — Agent configurations
│   ├── policies/          — Policy configurations
│   └── model-routing/     — AI model routing rules
│
├── infrastructure/
│   ├── database/          — Schema, migrations
│   ├── docker/            — Dockerfiles
│   ├── cloudflare/        — Edge configuration
│   └── ci/                — CI/CD scripts
│
├── docs/                  — Architecture and operational documentation
└── tests/                 — Root test suite
```

---

## Core Principles

1. **Business logic belongs to the OS** — not in AI prompts, frontend, or connectors
2. **Models are interchangeable** — provider-neutral AI gateway
3. **Every significant action is attributable** — full audit trail
4. **Continuous learning is governed** — candidates → validation → approval → knowledge

---

## Build Phases

| Phase | Status | Contents |
|---|---|---|
| 1 — Foundation | 🟡 In Progress | Monorepo, kernel, DB schema, auth, domain, events, audit, policies, approvals |
| 2 — Intelligence | ⬜ Next | AI gateway, model router, agents, knowledge, learning engine |
| 3 — MCP | ⬜ Pending | MCP server, core tools |
| 4 — Connectors | ⬜ Pending | Website, Google Workspace, Stripe, GitHub, Communications |
| 5 — Command Center | ⬜ Pending | Mobile dashboard, approvals, alerts, Ask Hutchrok |
| 6 — Business Modules | ⬜ Pending | Veteran filing, membership, post-formation, marketing, GovCon |
| 7 — Validation / Deploy | ⬜ Pending | Tests, security review, production readiness |

---

## Technology Stack

- **TypeScript** — all packages and apps
- **Node.js 22** — runtime
- **Hono** — API server
- **Next.js 15** — Command Center PWA
- **PostgreSQL / Supabase** — primary database
- **Drizzle ORM** — type-safe database access
- **Zod** — runtime schema validation
- **Vitest** — testing
- **pnpm + Turbo** — monorepo management
- **Docker** — local and container deployments
- **GitHub Actions** — CI/CD
- **Cloudflare** — edge, DNS, security (planned)

---

## Documentation

| Document | Description |
|---|---|
| [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) | System architecture |
| [DOMAIN_MODEL.md](./docs/architecture/DOMAIN_MODEL.md) | Domain entities |
| [EVENTS.md](./docs/architecture/EVENTS.md) | Event taxonomy |
| [POLICIES.md](./docs/architecture/POLICIES.md) | Policy and approval system |
| [AGENTS.md](./docs/architecture/AGENTS.md) | Agent definitions and runtime |
| [MCP.md](./docs/mcp/MCP.md) | MCP server and tools |
| [CONNECTORS.md](./docs/architecture/CONNECTORS.md) | Connector interfaces |
| [SECURITY.md](./docs/architecture/SECURITY.md) | Security practices |
| [DEPLOYMENT.md](./docs/architecture/DEPLOYMENT.md) | Deployment procedures |
| [RUNBOOK.md](./docs/runbooks/RUNBOOK.md) | Operational runbook |
| [CLAUDE.md](./CLAUDE.md) | Claude engineering agent guide |

---

## Owner

**Alfreddie Postell II** (King Fee) — Hutchrok Solutions Group LLC
**Engineering Authority** — Fee The Developer
**Builder** — Claude
**Primary Orchestration** — ChatGPT