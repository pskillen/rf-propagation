---
paths:
  - "**/*.{ts,tsx,md}"
---

# rf-propagation edits

Read [`AGENTS.md`](../../AGENTS.md) first. For git, plans, and docs see [`.skills/`](../../.skills/).

**Critical rules:** [layer-boundaries.md](layer-boundaries.md), [component-sidecars.md](component-sidecars.md), and [documentation-deliverables.md](documentation-deliverables.md). When editing related files, if you notice violations — even outside your current task — **flag them to the user as a high concern** before or alongside your main work. Do not silently ignore, copy the pattern, or defer without mention. Do not attempt to fix if it's outside the original instruction.

## Product shape

- **Engine** (`src/core/domain/propagation/`) — pure functions: geometry, layer model, reflection/MUF selection, link budget, multi-hop solving, coverage grid, illustration rays, validation harness. No React, no DOM.
- **Coverage-grid worker** (`src/integrations/propagation/`) — protocol, worker entry point, typed client wrapping the engine for off-main-thread grid computation.
- **App surfaces** (`src/app/routes/`) — Reach, Explore, Compare, Path, Conditions, Station; thin React state over engine calls, not reimplemented physics.

## SPA (`src/`)

- React + TypeScript under `src/app/`; Vite bundles for Cloudflare Pages.
- Build info via Vite `define` — see [version-number](../../.skills/version-number/SKILL.md).

## Scope

- Cloudflare Pages deploy via GitHub Actions, four-environment pattern (`dev` → `next` → `staging` → `prod`).
- Operator location and station data stay in browser storage only — never in the repo, never logged.
