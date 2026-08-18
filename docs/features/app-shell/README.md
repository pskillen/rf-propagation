# App shell and design system

The app shell is the first UI code in the repository: the copied
Codeplug Studio `v2` component kit and Mantine theme, a four-surface
routable shell (Reach/Path/Timeline/Explore), a URL-serializable state
codec every later surface registers its own fields with, and a
responsive control-panel-plus-canvas layout skeleton every surface
builds inside. At the time this phase shipped, nothing on screen did
anything yet — every surface was an empty, routable placeholder. Later
phases filled it in: Station (phase 6) and Conditions (phase 7) occupy
the two reserved chrome slots; [Reach](../reach/README.md) (phase 8) is
the first surface to call the propagation engine and no longer a
placeholder — Path, Timeline and Explore still are.

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Component kit + theme copy | Shipped | 27 of Studio's 40 `v2` components (the generic subset — Studio's project/build/membership/wire-export chrome excluded), base + v2 Mantine theme layers, `breakpoints.ts`/`iconSizes.ts`, the `dataTable` support lib — [component-kit-and-shell.md](component-kit-and-shell.md) |
| `DesignSystemV2Provider` mount | Shipped | Mounted once at the true root — a deliberate simplification from Studio's per-page nesting, since this app has no v1 pages — [component-kit-and-shell.md](component-kit-and-shell.md) |
| App chrome + four-surface routing | Shipped | `AppChrome` (new component, not a port of Studio's project-chip `AppShell.tsx`) + `react-router-dom` v7 data router — [component-kit-and-shell.md](component-kit-and-shell.md) |
| URL state codec | Shipped | Versioned, field-registry codec; only the `surface` field existed at this phase's own ship time — `station`/`conditions`/`bandId` (phase 7) and `target` (phase 8) have since been registered the same way — [url-state-codec.md](url-state-codec.md) |
| Responsive layout skeleton | Shipped | `SurfaceLayout` controls-plus-canvas grid, mounted on all four surfaces (Reach is no longer a placeholder as of phase 8) — [component-kit-and-shell.md](component-kit-and-shell.md) |
| Station bar / Conditions bar content | Both shipped | `stationBar` slot filled by `StationBar` (phase 6) — see [Station](../station/README.md); `conditionsBar` slot filled by `ConditionsBar` (phase 7) — see [Conditions](../conditions/README.md) |
| Any propagation-engine wiring | Not started (at this phase) | This phase itself imports nothing from `src/core/domain/propagation/` or `src/integrations/propagation/`; [Reach](../reach/README.md) (phase 8) is the first surface to call the engine |

## Documentation map

| Doc | Covers |
| --- | --- |
| [component-kit-and-shell.md](component-kit-and-shell.md) | What was ported from Studio's `v2` kit and what was excluded, the two components needed to compile the kit but not part of its public surface, `AppChrome`, `SurfaceLayout`, and the four-route shell (phase 5) |
| [url-state-codec.md](url-state-codec.md) | The versioned, per-field URL state codec: registration mechanism, versioning/degrade behaviour, and exactly what later phases are allowed to touch (phase 5) |

## Concepts

- **`v2` component kit** — Codeplug Studio's design-system v2: Mantine-based components scoped to a `.dsv2-scope` CSS class via `DesignSystemV2Provider`, forced dark mode. Copied, not shared as a package — drift between the two repos over time is accepted, per [AGENTS.md](../../../AGENTS.md) working principle 2.
- **Surface** — one of the four top-level views (Reach, Path, Timeline, Explore), each its own route. Distinct from *chrome* (the persistent Station/Conditions bars, visible on every surface).
- **Persistent chrome** — the Station bar and Conditions bar, reserved as empty slots on `AppChrome` in this phase, filled by phases 6 and 7 respectively. Always visible, on every surface, at every breakpoint.
- **`ViewerUrlState` vs `ViewerState`** — `ViewerUrlState` is the URL-serializable subset of state (what a shared link needs to reproduce a view); `ViewerState` is the full runtime state (includes things deliberately never persisted to the URL, e.g. `playback.playing`). See [url-state-codec.md](url-state-codec.md).

## Known gaps

- **No component sidecars for the ported kit.** Studio's own `<Component>.md` sidecar files were not copied (Slice 1 only ports `.tsx` + `.module.css`, per this phase's plan) — Studio's own docs, same component names, are the closest reference until this repo's copies diverge enough to need their own. `AppChrome.tsx` and `SurfaceLayout.tsx`, both new to this repo, do **not** yet have sidecars either — worth adding once phase 6/7 exercise their reserved-slot props in earnest.
- **`useViewerUrlState` was unused until phase 7.** The hook exists (`src/app/hooks/useViewerUrlState.ts`); `ConditionsBar` (phase 7) is its first caller, writing `conditions`/`bandId` (debounced for the time-scrub field). `surface` navigation is still entirely pathname-driven (`react-router-dom`'s routes), not query-string-driven, and Station (phase 6) still doesn't write to the URL live — see [url-state-codec.md](url-state-codec.md) and [Conditions](../conditions/README.md) for the reasoning.
- **`ViewerStateProvider` doesn't sync back to the URL.** It reads `surface` from `location.search` once, on mount, so a shared link's surface is respected on first paint — but nothing pushes runtime state changes back into the address bar yet (there's nothing to push: `surface` is the only field, and it's driven by route changes, not by `ViewerState`). This is explicitly left as "a later phase's own concern" by this phase's plan file.

## Cross-links

- Tracking: [Feature #5 "Design system and app shell"](https://github.com/pskillen/rf-propagation/issues/5) (parent epic [#2](https://github.com/pskillen/rf-propagation/issues/2))
- Task issues (phase 5): [#37](https://github.com/pskillen/rf-propagation/issues/37)–[#40](https://github.com/pskillen/rf-propagation/issues/40)
- Reference source (read-only, not linked from committed docs per [AGENTS.md](../../../AGENTS.md)): Codeplug Studio's `src/app/components/v2/`, `src/app/theme.ts`, `src/app/theme-v2.ts`
