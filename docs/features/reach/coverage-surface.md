# The 2D coverage surface

## Purpose

How Reach turns `computeCoverageGrid`'s output into a picture: the map
and station marker, the live-drag wiring, the canvas ground-shading
layer, and the hue/opacity scheme with its legend. Not covered here: the
summary strip and target selection — see
[target-selection.md](target-selection.md).

## Code anchors

- `src/app/routes/reach/ReachPage.tsx` — owns Station/Conditions/target
  state (via `useViewerState`), the live-drag `qth` override, and wires
  `useReachCoverage`/`useBestBandNow` into `ReachMap`/the controls column.
- `src/app/components/reach/ReachMap.tsx` — the Leaflet `MapContainer`,
  station marker (`drag`/`dragend`), `CoverageLayer` (mounts
  `CoverageCanvasLayer`), target marker, and `ClickToTarget`.
- `src/app/components/reach/CoverageCanvasLayer.ts` — the custom `L.Layer`
  canvas overlay: one `<canvas>` per map, redrawn on every new grid result
  and on map move/zoom/resize.
- `src/app/components/reach/coverageCellProjection.ts` — cell↔lat/lon:
  `cellCentre`/`cellCorners` (forward), `cellForLatLon` (inverse, Slice 5).
- `src/app/components/reach/cellFillStyle.ts` — the hue-by-`hopCount` /
  opacity-by-`reliability` shading formula, and `HOP_BAND_COLORS`
  (`CoverageLegend`'s single source of truth for its swatches).
- `src/app/components/reach/useReachCoverage.ts` — owns the
  `CoverageGridClient`/Worker for the live-drag surface.
- `src/app/components/reach/buildCoverageGridInput.ts` — Station +
  Conditions + frequency → `CoverageGridInput`; includes the geomagnetic
  latitude approximation (a judgment call — see Deviations).
- `src/app/components/reach/CoverageLegend.tsx` — the static legend panel.

## Inputs

- `ViewerState.station` / `.conditions` / `.frequencyMhz` (all lifted
  into shared state by this phase — see Deviations) feed
  `buildCoverageGridInput`.
- The live-drag `qth` override (a `ReachPage`-local `dragQth` state,
  distinct from `station.qth`) drives the coverage grid mid-gesture
  without waiting for the marker-drag to commit.

## Behaviour

### Live-draggable station marker

Leaflet's `Marker` fires `drag` continuously while the pointer moves and
`dragend` once, on release. `ReachMap` wires both: `drag` calls
`onStationDrag(lat, lon)` (Slice 2: `recompute({lat, lon})`, a coarse-pass
request through `CoverageGridClient`); `dragend` calls
`onStationDragEnd(lat, lon)`, the only point a QTH change is persisted
(`mergeStation`) — "debouncing applies to persistence, never to
rendering." mk1's `MapLocationPicker.tsx` only ever wired `dragend`, so
dragging there did nothing until release; this is the anti-pattern this
phase exists not to repeat.

The Marker's `position` prop stays bound to the committed `station.qth`
throughout an entire drag gesture — never reassigned to the live drag
position — so React never fights Leaflet's own internal drag state (the
same corruption `QthMap.tsx`'s own comment already documents for a
different cause, `icon` identity churn).

### `CoverageCanvasLayer`

A `CoverageGridResult` has up to 72 × `rangeBinCount` (320) cells;
rendering each as a Leaflet `Polygon` is exactly the "thousands of scene
objects" F5.2 rules out. Instead, one `<canvas>` is appended to the map's
`overlayPane`, resized/repositioned via `map.getSize()` /
`containerPointToLayerPoint`, and redrawn on every `setResult` call and
on `move`/`zoom`/`resize`. Each populated cell (`hopCount !== 255`) is
filled as a quad (the cell's four `destinationPoint`-projected corners),
not an arc — a fine approximation at 5°×50km resolution.

**Coarse-then-fine cross-fade:** `setResult(result, station, pass)`
tracks the previous pass; a `coarse → fine` transition gets a brief
(180ms) opacity dip-then-settle so the fine pass doesn't visibly "pop."
A `coarse → coarse` transition (mid-drag) is instantaneous — no fade —
so the live-drag feel stays snappy.

### Cell↔lat/lon projection

Cell `(azimuthIndex, rangeBin)`'s centre bearing is
`azimuthIndex × (360 / azimuthCount)` degrees true, centre range
`rangeBin × rangeBinKm + rangeBinKm / 2` km — converted via the engine's
own `destinationPoint` (great-circle, not a flat approximation), so
shading never visibly drifts near the poles/date line.
`coverageCellProjection.ts`'s `cellForLatLon` is the inverse (bearing/
range from a clicked point back to a cell coordinate — built for Slice 5,
though the target itself is recorded from Leaflet's own click `latlng`
directly, not by round-tripping through a cell index; see
[target-selection.md](target-selection.md)).

### Shading scheme and legend

**Not specified numerically anywhere in the design doc set — this phase
invents one, flagged exactly like phase 4 flagged its own groundwave-
range/reference-mode judgment calls.** Phase 9 (Globe) must reproduce it
exactly for F6.3's "reads consistently with the 2D map."

- **Hue by `hopCount`:** groundwave `#4d7cff` (blue, echoing mk1's
  `MODE_COLORS.groundwave`), hop 1 `#3ddc97`, hop 2 `#f5a623`, hop 3
  `#e8590c`, hop 4 `#c92a2a` — cool → warm as hop count rises.
  `hopCount === 255` (skip zone) gets **zero fill** — the map tile shows
  through unshaded, reading as "checked, and there's nothing here," not
  "not yet computed."
- **Opacity by `reliability`:** `0.15 + 0.65 × reliability`, so even a
  low-but-nonzero cell stays faintly visible — "poor but real" reads
  differently from "no coverage" (FR-9's "no bare booleans," extended to
  the picture itself).
- **`CoverageLegend`** is a static, always-visible panel (no popover
  mechanism needed yet — F8.4/phase 11) reading its swatch colours
  straight from `HOP_BAND_COLORS`, so the legend can never drift from the
  actual shading formula.

## Deviations

- **Station/Conditions lifted into `ViewerState`.** Phases 6/7 kept both
  as component-local state inside `StationBar`/`ConditionsBar`, even
  though `viewerState.tsx`'s own doc comment (written in phase 5)
  anticipated both living in shared state. Reach is the first surface
  that needs to read both from outside those chrome bars, and — via the
  marker drag — needs to _write_ Station too. `station` becomes the
  single source of truth in `ViewerState` (`StationBar` reads/writes it
  there instead of local `useState`); `conditions`/`bandId`/
  `frequencyMhz` stay owned by `ConditionsBar`'s existing hooks but are
  published one-way into `ViewerState` on every change. See
  `src/app/state/viewerState.tsx`'s own doc comment for the full
  reasoning.
- **Geomagnetic latitude approximation.** `layerStates`'s `geomagLatDeg`
  parameter had only ever been fed literal test constants before this
  phase. `buildCoverageGridInput.ts` adds a simple fixed-pole dipole
  approximation (~80.7°N, 72.7°W) — adequate for its role as a coarse
  latitude-band modifier on F2 critical frequency, not a full IGRF/AACGM
  model. Kept in the app layer (not `src/core/domain/propagation/`) per
  this phase's own "adds no engine code" invariant.
- **`haversineDistanceKm`/`initialBearingDeg`** (the inverse of
  `destinationPoint`) live in `src/app/lib/geo/bearingDistance.ts`, not
  `src/core/domain/propagation/greatCircle.ts` — same "no engine code"
  invariant; ported in shape from Codeplug Studio's `geoDistance.ts` but
  adapted to this repo's `GeoPoint`/kilometre conventions instead of
  Studio's separate lat/lon arguments and metres.
- **React 19 StrictMode double-invoke bug (fixed within this phase).**
  `useReachCoverage`/`useBestBandNow` originally created their
  `CoverageGridClient` eagerly during render and only destroyed it in an
  effect cleanup — under StrictMode's dev-only mount→cleanup→mount replay,
  the phantom cleanup killed the Worker and nothing recreated it, so the
  real app hung forever on "Computing coverage…"/"Ranking bands…" while
  every automated test (which doesn't render in StrictMode) passed. Fixed
  by creating the client inside the same effect that destroys it. Caught
  only by live browser verification — see this phase's PR description.

## Manual verify

1. `npm run dev`, open Reach (the default route).
2. Confirm the station marker and shaded coverage grid render around the
   default station (Birmingham, UK).
3. Drag the marker — the shading should visibly follow the pointer while
   still moving, not just after release.
4. Release the drag — the Station bar's summary (callsign locator)
   updates, and the shading settles on the fine pass.
5. Resize to 360px wide (or a phone) — no horizontal scroll, controls
   stack above the map.

## Known gaps

- No 3D globe (phase 9) — 2D map only, by design (F5's own framing, and
  2D is the mobile default).
- No ray controls anywhere on this surface, by design — see this
  feature's [README.md](README.md).
- The shading palette (hex values, opacity formula) is this phase's own
  invented convention, not sourced from any design doc — flag any future
  change here loudly, since phase 9 depends on reproducing it exactly.

## Related

- [../engine/multihop-coverage-and-rays.md](../engine/multihop-coverage-and-rays.md) — `computeCoverageGrid`, the Worker protocol, coarse/fine two-pass.
- [../station/README.md](../station/README.md), [../conditions/README.md](../conditions/README.md) — the two inputs this surface is the first to actually wire to the engine.
- [target-selection.md](target-selection.md) — the rest of this phase.
