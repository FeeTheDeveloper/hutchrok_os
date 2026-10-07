---
version: alpha
name: "Hutchrok Command Center"
description: "A guarded operations deck that makes authority, boundaries, and recovery readiness visible."
colors:
  ink: "#071116"
  ink-raised: "#0D1A20"
  paper: "#E9E6DE"
  muted: "#92A0A4"
  line: "#263A42"
  signal: "#E7A941"
  oxidized: "#63A7AC"
  danger: "#E16F5A"
  ready: "#8AB58A"
typography:
  display:
    fontFamily: "Arial Narrow, Aptos Narrow, Roboto Condensed, sans-serif"
  body:
    fontFamily: "Aptos, Segoe UI, sans-serif"
  data:
    fontFamily: "Cascadia Mono, IBM Plex Mono, Consolas, monospace"
rounded:
  sm: "0.375rem"
  md: "0.75rem"
  lg: "1.125rem"
spacing:
  control-gap: "1.5rem"
  section-block: "7rem"
components:
  status-pill: {}
  operator-panel: {}
  control-stage: {}
---

# Hutchrok Command Center Design System

## Overview

### Creative North Star

The interface should feel like a field operations binder translated into a modern command deck: numbered checkpoints, physical interlocks, honest material states, and no decorative telemetry. The connection board separates repository intent, local configuration presence, and verified live state.

### Product context and register

- **Audience and primary job:** Hutchrok operators reviewing what needs attention, what is permitted, and what remains unsafe to activate.
- **Target market and evidence:** Internal United States operations; repository policy and FTD-CORE-001 review are the current evidence sources.
- **Locale and language policy:** English (`en`) with plain operational language.
- **Usage scene:** Frequent desktop review with a complete narrow-screen layout for urgent mobile checks.
- **Register:** Product/admin.
- **Memorable signature:** A light control spine shows intake, policy, approval, external effect, and audit as one governed path.
- **Restraint:** Decisions and failure boundaries carry emphasis; routine panels remain quiet and dense.
- **Anti-references:** No speculative live metrics, generic gradient SaaS cards, fake action buttons, or status color without text.
- **Token ownership/runtime mapping:** Runtime CSS in `src/app/globals.css` is canonical. This file mirrors the accepted semantic values; shared page styles consume those variables directly.

## Colors

`ink` and `ink-raised` create the operator environment. `paper` is reserved for the control spine so governance reads as a physical checkpoint. `signal` marks human attention, `danger` marks a hard block, `oxidized` carries orientation text, and `ready` is reserved for verified readiness. Every status includes a text label.

## Typography

Condensed display type gives headings an equipment-label character without sacrificing scan speed. Body copy uses the local platform sans stack. IDs, states, and small labels use the data stack with tabular-feeling rhythm. Interface copy uses sentence case; short equipment labels may use uppercase.

## Layout

The desktop shell uses a wide asymmetric grid and a 1440px content ceiling. The control spine is horizontal on wide screens and becomes a vertical checkpoint sequence below 900px. Content scrolls naturally; individual panels do not trap page scroll. Mobile gutters are 1rem and all content remains available without hidden navigation dependencies.

## Elevation & Depth

Hierarchy comes from tonal layers and one-pixel borders. Static cards do not use drop shadows. Only critical signals may use a restrained glow. The sticky top bar uses blur to preserve orientation while content passes beneath it.

## Shapes

Panels use the `lg` radius, internal groups use `md`, and controls use pills only when communicating a compact status. The control spine uses lines and nodes instead of rounded cards to communicate ordered gates.

## Components

### Foundational visual states

Status pills always pair color with text. Hover is reserved for real navigation. Focus-visible uses a two-pixel signal outline. Loading or unavailable data must preserve layout and state the missing source instead of displaying invented values.

### Buttons and actions

No consequential action appears until identity, capability, approval, idempotency, and recovery requirements are implemented. Navigation uses links; unavailable operations are represented as status, not disabled-looking buttons.

### Navigation and data display

The top bar provides section anchors on wide screens. The primary flow is overview, governed path, attention queue, external-effect boundaries, then recovery gates. Data states use concise labels with supporting evidence text.

### Forms and overlays

None are currently part of this read-only surface. Future approval forms require a maintained shared field pattern, app-owned confirmation, immutable draft binding, and failure recovery.

### Iconography

Use simple inline geometric marks with 1.5px strokes. Labels remain mandatory for operational meaning.

### Motion

Motion is limited to short navigation feedback. Reduced-motion preference disables smooth scrolling and transition duration.

### Content and data visualization

Use factual operational language. Repository-derived readiness is labeled as such. Never imply live providers, customers, revenue, deployment, or production health from local code alone.

## Do's and Don'ts

- **Do:** Make the authority and recovery requirement visible beside every risky state.
- **Do:** Keep production-blocked and data-source labels persistent.
- **Do:** Use green only for a named scope, such as “enabled in kernel” or an executed repository check.
- **Don't:** Render placeholder values as live operational telemetry.
- **Don't:** Treat an environment variable, `enabled: true`, or an HTTP response alone as proof of account-bound provider access.
- **Don't:** Add an action control before its server-side authorization and audit path exists.
