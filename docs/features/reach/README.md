# Reach

**Reach** is the signature feature and the first genuinely useful
artefact in the product: a 2D map, the station marked, the coverage grid
(the propagation engine's `computeCoverageGrid`, phase 4) rendered as
shaded ground — groundwave disc, skip zone, hop 1–4 bands all legible at
a glance — a best-band-now summary strip, and cell selection that records
a target. It's the first surface to bind Station (phase 6) and
Conditions (phase 7) to the engine at all; both phases' own docs list
"propagation engine wiring" as "not started" until this one.

mk1 (the prior in-Studio version) drew this picture with individual
illustration rays and constant-radius rings for groundwave/skip zone —
both defects the engine's own validation harness and design doc set
called out explicitly. Reach never draws a ray: `computeCoverageGrid`
and `generateIllustrationRays` are two genuinely separate code paths
(phase 4's own architectural point), and this surface only ever calls
the former. Ray controls (radial count, elevation count, elevation
spread) belong to Explore (phase 11), not here — Reach has no ray-count
input that could, even in principle, change a coverage value.

Dragging the station marker animates the shaded surface live, using a
coarse pass, while the pointer is still moving — not just on release.
This is a *standing constraint* every later UI phase inherits, not a
discrete feature phase 10's transport control retrofits.

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| 2D map + live-draggable station marker | Shipped | Leaflet `MapContainer` + a `divIcon` marker wiring both `drag` (continuous) and `dragend` (commit) — [coverage-surface.md](coverage-surface.md) |
| Coverage grid as canvas ground-shading | Shipped | A custom `L.Layer` canvas overlay, not one Polygon per cell; coarse-then-fine cross-fade — [coverage-surface.md](coverage-surface.md) |
| Hop-band/reliability shading + legend | Shipped | Hue by `hopCount`, opacity by `reliability`, zero fill for the skip zone; a static always-visible legend — [coverage-surface.md](coverage-surface.md) |
| Best-band-now summary strip | Shipped | Current band's reach extremes (from the already-computed grid) + a per-band mean-reliability ranking swept on Station/Conditions change — [target-selection.md](target-selection.md) |
| Cell selection sets a target | Shipped | Map click records `ViewerState.target`; a same-surface `TargetPanel` until Path (phase 13) exists; registered with the URL codec — [target-selection.md](target-selection.md) |
| The 3D globe | Not started | Phase 9 — Reach is 2D-map-only; the globe reuses this phase's exact shading formula |
| Transport control / realism unlock / permalink / presets | Not started | Phase 10's discrete F7 tickets; live-drag response here is the standing constraint those tickets build UI around |
| Full Path view / verdict table | Not started | Phase 13 — Slice 5 only records a target and shows a minimal same-surface summary |
| Per-operator licence class | Not started | Inherited gap from phase 7 (`BandChips.tsx`) — "best band now" ranks all of `UK_AMATEUR_BANDS` unfiltered, since no licence-class model exists anywhere yet |

## Documentation map

| Doc | Covers |
| --- | --- |
| [coverage-surface.md](coverage-surface.md) | The map, live-draggable marker, `CoverageCanvasLayer`, cell↔lat/lon projection, and the hue/opacity shading scheme + legend |
| [target-selection.md](target-selection.md) | Reach-extremes extraction, the best-band-now per-band ranking, and cell-selection target recording |

## Concepts

- **Coverage grid vs illustration rays** — see the engine's own
  [multihop-coverage-and-rays.md](../engine/multihop-coverage-and-rays.md#illustration-rays)
  ("Coverage-grid independence (the critical property)"). Reach renders
  only the former; this is the one architectural point in this phase
  worth over-stating, per its own plan file.
- **Coarse-then-fine two-pass** — every `computeCoverage` request
  produces a quarter-resolution coarse result immediately, then the
  full-resolution fine result; `CoverageGridClient` guarantees rapid
  successive requests (a drag gesture) leave exactly one fine result
  standing.
- **Skip zone as deliberate absence** — an unshaded cell inside the
  shaded region's outer boundary reads as "checked, and there's nothing
  here," not "not yet computed" — see
  [coverage-surface.md](coverage-surface.md).
- **Target** — `ViewerState.target`: `null` means Reach (no target set),
  a populated value means Path (FR-14) once phase 13 exists. This phase
  only records it and shows a minimal same-surface summary.

## Cross-links

- Tracking: [Feature #7 "Reach"](https://github.com/pskillen/rf-propagation/issues/7)
- Task issues (phase 8): [#49](https://github.com/pskillen/rf-propagation/issues/49)–[#53](https://github.com/pskillen/rf-propagation/issues/53)
- Reference source (read-only, not linked from committed docs per [AGENTS.md](../../../AGENTS.md)): Codeplug Studio's `src/app/components/PropagationTopDownMap/`, `src/app/components/MapLocationPicker/`, `src/app/components/map/leafletSetup.ts`, `src/core/domain/geoDistance.ts` — structural shape only; mk1's ring-drawing (`footprint.ts`) is explicitly not ported, superseded by the coverage grid.
