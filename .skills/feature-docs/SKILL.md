---
name: feature-docs
description: >-
  How rf-propagation documents features under docs/features/. Use when
  implementing or changing any user-facing feature, route, integration workflow,
  or shared component — not only when explicitly asked to write docs. Also for
  progress/outstanding logs and reverse-engineering behaviour for a ticket.
---

# rf-propagation feature documentation

Canonical feature docs live under **`docs/features/<topic>/`** (created as the first feature lands). User-facing overview stays in [`README.md`](../../README.md); feature docs target contributors and agents.

Read [progress-tracking](../progress-tracking/SKILL.md) when an initiative needs execution handoff files.

**Focus:** the four product surfaces (Reach, Explore, Compare, Path/Timeline), the Station/Conditions model, and the propagation engine — not implementation trivia that belongs in code comments.

**Obligation:** docs ship in the **same PR** as the behaviour they describe — not deferred to a follow-up.

---

## Component sidecars (`src/app/components/`)

Reusable UI primitives and widgets get a **sidecar** `<ComponentName>.md` next to the component — not a duplicate hub under `docs/features/`.

| Layer | Where | Contents |
| --- | --- | --- |
| **Sidecar** | `src/app/components/<Name>/<Name>.md` | Props, usage, behaviour for contributors |
| **Feature hub** | `docs/features/<topic>/README.md` | Product workflow, status table, links to sidecars |

See [make-a-plan §5](../make-a-plan/SKILL.md).

---

## Folder layout

| Pattern | When to use | Examples |
| --- | --- | --- |
| **`<topic>/README.md`** | Every feature area — hub page | `reach/README.md`, `station/README.md` |
| **Single-file topics** | One concern without a folder | `maidenhead.md` |
| **Sibling deep dives** | One concern per file; README is the map | `coverage-surface.md`, `antenna-patterns.md` |
| **`*-progress.md` / `*-outstanding.md`** | Multi-step plans or tickets spanning PRs | `phase-1-progress.md` |

**Slug:** kebab-case matching the product concept (`reach`, `station`), not necessarily a component filename.

**Do not** put the full plan backlog in `*-outstanding.md` — only debt discovered during execution.

---

## README hub template

Every feature README should open with **what problem the feature solves** (1–2 paragraphs), then:

1. **Implementation status** — table: area | status | notes (shipped / in progress / deferred).
2. **Documentation map** — table linking sibling docs.
3. **Concepts** — key domain terms this feature area introduces (e.g. skip zone, greyline, MUF).
4. **Optional diagram** — mermaid when data flow is non-obvious (Station → engine → coverage surface).
5. **Cross-links** — tracking GitHub issue, live deployed URL when applicable.

Stay within the feature boundary: a surface's docs cover that surface's behaviour, not general amateur-radio propagation theory.

---

## Deep-dive page template

Use for engine behaviour, merge behaviour, UI interaction, etc.

| Section | Contents |
| --- | --- |
| **Purpose** | What this slice covers vs the hub README |
| **Code anchors** | `src/core/`, `src/app/features/` — modules and services by name |
| **Inputs** | Station/Conditions state, engine parameters |
| **Behaviour** | Filters, defaults, edge cases |
| **Browser storage** | localStorage keys — never commit values |
| **Manual verify** | Steps to exercise the behaviour locally |
| **Known gaps** | Deferred features, documented fidelity limits (e.g. "not modelled: sporadic-E") |
| **Related** | Other feature docs, product doc set, issues |

Prefer **tables** for entity fields and UI controls. Use small **JSON or YAML snippets** when shape matters.

---

## Progress and outstanding pair

Create both at **plan kickoff** only when [progress-tracking](../progress-tracking/SKILL.md) applies (multi-session / multi-PR). Update per that skill.

| File | Role |
| --- | --- |
| `*-progress.md` | Shipped slices, PR links, branch, verify steps, **Next** |
| `*-outstanding.md` | Checkboxes for discovered debt — each open item links a GitHub issue |

Link both from the tracking GitHub issue and the Cursor plan **Progress tracking** section.

**After the initiative ships:** retire the pair per progress-tracking **When to retire / delete** — hub status table + GitHub issues become canonical; do not keep stale progress logs forever.

---

## Style conventions

- **British English** in prose is fine; code identifiers stay as in repo.
- Link GitHub issues/PRs with full URLs: `[rf-propagation#1](https://github.com/pskillen/rf-propagation/issues/1)`.
- Use relative links between docs: `[coverage-surface.md](coverage-surface.md)`.
- Cite **concrete defaults** where behaviour depends on them.
- When behaviour changes, update the **feature doc** and any affected code comments.
- **Reverse-engineering ticket:** document *current* behaviour first before implementing changes.
- **Timeless vs point in time**
  - Feature docs describe how the product works today.
  - Progress and outstanding files are point-in-time execution logs.
- Any documented model limitation (fidelity gap, unmodelled effect) should say so plainly — this is a public playground, and silent gaps in what the engine models are worse than stated ones.

---

## Index maintenance

When adding a new feature folder:

1. Add a row to `docs/features/README.md` (create this index alongside the first feature folder).
2. Optionally add a one-line link from [`AGENTS.md`](../../AGENTS.md)'s repository layout table when a new top-level area ships.

---

## Anti-patterns

- Duplicating the entire README into feature docs.
- One giant README with no map (split when > ~150 lines or multiple audiences).
- Outstanding file copied from the Cursor plan todo list.
- Documenting aspirational behaviour as shipped — use **Implementation status** and **Known gaps**.
- Describing engine fidelity as better than it is — known gaps belong in the doc, not just the code comments.
