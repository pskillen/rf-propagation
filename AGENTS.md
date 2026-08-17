# Agent guide — Propagation Viewer (rf-propagation)

Instructions for AI agents working in this repository.

## What this repo is

**Propagation Viewer** is a browser-based HF propagation playground for radio amateurs — see what the ionosphere is doing to a signal (skip zones, hop distance, greyline, band-by-band reach) rather than guessing. It is a ground-up rewrite of an RF/HF propagation visualiser feature that previously shipped inside [Codeplug Studio](https://github.com/pskillen/codeplug-studio), now built and shipped as its own product.

**Current phase: pre-build.** There is no application code in this repository yet — see [README.md](README.md) for status. This file will grow a repository-layout table, layer-boundary rules, and vendor/testing conventions once the app scaffold and `docs/` structure exist; don't expect the full shape of a mature repo's `AGENTS.md` here yet.

**Product context:** the design/PRD doc set for this rebuild currently lives at `tmp/mvp-plan/` — gitignored scratch space, present on disk but not committed. Read it locally for product intent, requirements, and the physics/fidelity spec; do not add committed links into it (paths there aren't guaranteed to persist). As delivery proceeds, the parts of that doc set that describe *shipped* behaviour get promoted into a committed `docs/` tree, following [feature-docs](.skills/feature-docs/SKILL.md).

## Planned architecture

Once scaffolded, this repo will use the same layer split and path-alias convention as Codeplug Studio:

| Layer | Path | Contains |
| --- | --- | --- |
| **core** | `src/core/` | Domain models, the propagation engine, pure functions — no React, no DOM APIs |
| **integrations** | `src/integrations/` | Browser I/O — worker/network/storage adapters |
| **app** | `src/app/` | Routes, features, components, thin React state |

**Dependency rule (once code exists):** `app` → `core`; `integrations` → `core`. Never `core` → `app`.

Stack: React + Vite + TypeScript, deployed to Cloudflare Pages, same four-environment pattern as Codeplug Studio (`dev` → `next` → `staging` → `prod`) — see `tmp/mvp-plan/new-app-migration.md` while it exists.

## Repository layout (current)

| Path | Role |
| --- | --- |
| `README.md` | User-facing overview (currently a placeholder) |
| `AGENTS.md` | This file — agent workflow index |
| `.skills/` | Agent skills — git workflow, plans, docs, progress (ecosystem-agnostic; not `.cursor/` or `.claude/`) |
| `tmp/` | Gitignored scratch space — planning docs (`tmp/mvp-plan/`), and any per-feature planning under `tmp/features/<name>/` per [multi-phase-plan](.skills/multi-phase-plan/SKILL.md) |
| `docs/features/` | Shipped feature documentation, one folder per topic — see [feature-docs](.skills/feature-docs/SKILL.md); starts with `docs/features/engine/` (propagation engine geometry/layers/MUF/link budget/multi-hop/coverage grid) and `docs/features/app-shell/` (component kit, app chrome, URL state codec) |
| `src/core/domain/propagation/` | The propagation engine's pure functions (geometry, layer model, reflection/MUF selection, link budget, multi-hop solving, coverage grid, illustration rays, validation harness) — no React, no DOM |
| `src/integrations/propagation/` | The coverage-grid Worker: protocol, worker entry point, and typed client — no React |
| `src/app/` | Routes, the copied `v2` component kit and theme, app chrome/layout, and the URL state codec — see `docs/features/app-shell/` |

Remaining application directories (`docs/reference/`, etc.) will be added as later delivery phases need them — see the bootstrap checklist in the product doc set.

## Skills

This repo uses `.skills/<name>/SKILL.md` rather than a `.cursor/skills/` or `.claude/skills/` layout, so the same instructions work across AI tooling. Read the relevant skill before doing the matching kind of work:

| Skill | Use for |
| --- | --- |
| [git-workflow](.skills/git-workflow/SKILL.md) | Branching, commits, PRs — read this first for any change |
| [make-a-plan](.skills/make-a-plan/SKILL.md) | Turning GitHub issue(s) into a Cursor execution plan |
| [multi-phase-plan](.skills/multi-phase-plan/SKILL.md) | Epic-sized work: brainstorm → design doc → tickets → phased delivery plans |
| [drive-by-ticket](.skills/drive-by-ticket/SKILL.md) | Shipping a small ticket end-to-end without a plan file |
| [progress-tracking](.skills/progress-tracking/SKILL.md) | Progress/outstanding logs for multi-session work |
| [feature-docs](.skills/feature-docs/SKILL.md) | Where and how product/feature documentation is written |
| [version-number](.skills/version-number/SKILL.md) | Build-env/version footer (once the app is scaffolded) |
| [debounced-inputs](.skills/debounced-inputs/SKILL.md) | Persisted text/number/slider input pattern (once inputs exist) |

## Working principles

1. **Physics correctness is the product's core risk.** The prior in-Studio version shipped a propagation model with real defects; this rebuild's first deliverable is the engine plus a validation harness, and every later engine change must keep it green. Do not treat round-trip/system tests as a substitute for it.
2. **Copy, don't share, the Codeplug Studio component kit.** The look and feel is copied into this repo in one unmodified commit (see the migration doc), not published as a shared package. Accept drift between the two over time.
3. **Docs ship with behaviour** — see [feature-docs](.skills/feature-docs/SKILL.md).
4. **Minimize scope** — one feature per PR; match existing patterns once a scaffold exists.
5. **Privacy** — operator location and station data stay in browser storage only; never in the repo.

## Git workflow

Follow [`.skills/git-workflow/SKILL.md`](.skills/git-workflow/SKILL.md).

- Prefer **atomic conventional commits** per logical change.
- Branch + pull request for features; `main` holds releasable source.
- Use the **`github-personal`** MCP for issues and PRs — not the `gh` CLI, and not any other GitHub MCP configured in this environment.
- Do not commit `.env`, secrets, or personal location/station data.

## Plans

- Plan from GitHub issues: [make-a-plan](.skills/make-a-plan/SKILL.md).
- Ship a ticket without a plan: paste `#N` + title and `@drive-by-ticket` — [drive-by-ticket](.skills/drive-by-ticket/SKILL.md).
- Epic-sized work: [multi-phase-plan](.skills/multi-phase-plan/SKILL.md).

## Disclaimer

Frequency and propagation data is for amateur operating convenience. Not authoritative for emergency operations.
