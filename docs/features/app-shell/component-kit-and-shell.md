# Component kit, app chrome, and layout skeleton

## Purpose

Covers what phase 5 ported from Codeplug Studio's `v2` design-system kit,
what it deliberately left out, the two files needed to make the ported
kit compile that aren't themselves part of the kit's public surface, and
the shell components built new for this app: `AppChrome` and
`SurfaceLayout`. Not covered here: the URL state codec — see
[url-state-codec.md](url-state-codec.md).

## Code anchors

- `src/app/components/v2/` — the ported kit (27 components + barrel).
- `src/app/theme.ts`, `src/app/theme-v2.ts` — Mantine base theme and the v2
  design-system token layer.
- `src/app/lib/breakpoints.ts`, `src/app/lib/iconSizes.ts` — shared tokens
  the kit components read.
- `src/app/lib/dataTable/` — `DataTable.tsx`'s support code (sort,
  virtualization, bulk reorder).
- `src/app/components/shell/AppChrome.tsx` — brand, primary nav, the two
  reserved chrome slots, build footer.
- `src/app/components/layout/SurfaceLayout.tsx` — the controls-plus-canvas
  grid every surface renders inside.
- `src/app/App.tsx` — `react-router-dom` v7 data router wiring.
- `src/app/routes/{reach,path,timeline,explore}/` — the four placeholder
  surface pages.

## What was ported, and what wasn't

27 of Studio's 40 `v2` components were copied — the generic subset,
everything not tied to Studio's project/build/membership/wire-export
concepts. Excluded: `AppShell.tsx`, `ProjectChip.tsx`, `EditorHeader.tsx`,
`MembershipRow.tsx`, `MembershipPanel.tsx`, `MembershipPoolRow.tsx`,
`AddMembersScreen.tsx`, `WirePreviewTable.tsx`, `WriteVerifyReport.tsx`,
`UnsavedChangesModal.tsx`, `OverrideField.tsx`,
`SelectedItemDragHandle.tsx` (see below — it turned out one ported
component needs it). This list was derived by inspecting Studio's actual
source, not guessed.

Test files (`.test.tsx`) and doc sidecars (`.md`) were not ported — only
`.tsx` + matching `.module.css`, matching the phase's own scope for a
"land the copy in one commit, unmodified" diff against Studio.

### Two adaptations needed for the copy to actually compile

`DataTable.tsx` (ported — it's generic, not codeplug-specific) has two
dependencies the initial exclude list didn't anticipate:

1. **`SelectedItemDragHandle.tsx`** is on the exclude list (described
   there as a "membership-list reorder handle"), but `DataTable.tsx`
   imports it directly for its drag-to-reorder row handle. It was ported
   alongside `DataTable.tsx` — excluding it would have broken a component
   the kit explicitly wants. It is **not** re-exported from
   `src/app/components/v2/index.ts`; it's an internal implementation
   detail of `DataTable`, not part of the kit's public surface.
2. **`reorderKeysByDrag`/`reorderSelectedKeys`** — `DataTable.tsx` and
   `DataTableBulkReorder.tsx` import these from Studio's
   `@core/domain/zoneOrder.ts`, which otherwise pulls in Studio's
   codeplug Zone/`BuildEntityOverride` domain model (irrelevant here).
   Only the two generic key-list algorithms actually used were extracted,
   logic unchanged, into `src/app/lib/dataTable/keyOrder.ts`, and the two
   import sites were repointed at it.

Three dependency groups not in the phase's original peer-dep list were
also required and added: `@dnd-kit/core`/`@dnd-kit/sortable`/
`@dnd-kit/utilities` (DataTable's drag-reorder) and
`@tanstack/react-virtual` (`useVirtualDataTableRows.ts`'s virtualization).

## `AppChrome`

Not a port of Studio's `AppShell.tsx` — that component is built around a
project chip, avatar slot, and Google Drive controls, none of which have
an analogue in a propagation-only app with no accounts or builds.
`AppChrome` is new: brand, primary nav (desktop top nav + mobile
`BottomTabBar`, both in the DOM, breakpoint-visibility only, matching the
"collapse to summary lines, expand to sheets" mobile pattern the reserved
bars will follow), the two reserved chrome slots
(`stationBar`/`conditionsBar` props, `ReactNode`, both `undefined` until
phases 6/7), the routed surface (`children`), and `BuildFooter` (phase
1).

```ts
export interface AppChromeProps {
  stationBar?: ReactNode; // phase 6
  conditionsBar?: ReactNode; // phase 7
  children: ReactNode;
}
```

This prop shape is load-bearing for phases 6+: phase 6 passes its
Station-bar component as `stationBar` without changing `AppChromeProps`;
phase 7 does the same for `conditionsBar`.

## Routing

`react-router-dom` v7's data-router API (`createBrowserRouter` +
`RouterProvider`), matching Studio's own `App.tsx` pattern:

| Path        | Page           | Real surface lands |
| ----------- | -------------- | ------------------ |
| `/`         | `ReachPage`    | Phase 8            |
| `/path`     | `PathPage`     | Phase 13           |
| `/timeline` | `TimelinePage` | Phase 14           |
| `/explore`  | `ExplorePage`  | Phase 11           |

Deep-linking works on a cold load (verified via `vite preview` + loading
`/timeline` directly) because `public/_redirects` (phase 1) still routes
`/* /index.html 200`.

## `SurfaceLayout`

The controls-plus-canvas grid every surface builds inside — see its own
sidecar, [`SurfaceLayout.md`](../../../src/app/components/layout/SurfaceLayout.md),
for the props contract and responsive behaviour.

## Manual verify

```sh
npm run build && npm run preview
```

- Load `/`, `/path`, `/timeline`, `/explore` directly (not via client
  navigation) — each renders its own placeholder, not a 404 or a bounce
  to `/`.
- Resize to ≤48em (or below) — the top nav hides, `BottomTabBar` appears
  at the bottom, and the active tab matches the current route.
- Resize to 360px width on any surface — no horizontal scrollbar.
- The Reach placeholder shows a `Panel` containing a `TextInput`, a
  `Pill`, and a `Button` with the v2 dark theme visibly applied (not just
  compiling) — this is the kit-sample block Slice 1 required.

## Known gaps

- No sidecars yet for `AppChrome.tsx` or `SurfaceLayout.tsx` beyond
  `SurfaceLayout.md` — see the feature hub's Known gaps.
- The kit-sample block in `ReachPage.tsx` is temporary scaffolding
  proving the theme applies; phase 8 replaces it with the real Reach
  surface.

## Related

- [README.md](README.md) — feature hub, implementation status
- [url-state-codec.md](url-state-codec.md)
