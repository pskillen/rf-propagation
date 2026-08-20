# Cross-section and ray overlay

## Purpose

The vertical cross-section (F8.1) and the illustration ray overlay
(F8.2/F8.3) — Explore's core visual: a labelled 2D side-on slice through
the ionosphere along the current bearing, and the operator controls that
shape which rays render on it (and on the 3D globe).

## Code anchors

- `src/app/routes/explore/VerticalCrossSection.tsx` — the diagram.
- `src/app/routes/explore/crossSectionLayerBands.ts` — pure layer-band
  extraction (which of D/E/F1/F2 are active right now).
- `src/app/routes/explore/RayOverlayControls.tsx` — radials/elevations/
  elevation spread/bearing, outcome filter, colour-by, layer-solo.
- `src/app/routes/explore/useExploreRays.ts` — the single
  `generateIllustrationRays` call per `display`/station/conditions/target
  change; also `selectPrimaryRay`, which reuses one ray from that same
  result for the cross-section's bolded "primary hop" polyline rather
  than requesting a second one.
- `src/app/routes/explore/rayVisual.ts` — `applyRayVisuals`: outcome
  filtering, colour-by (outcome/layer/signal-strength), layer-solo
  dimming — all pure transforms over the generated ray array.
- `src/core/domain/propagation/rayDashPattern.ts` — outcome-keyed dash/
  gap arc lengths, ported (narrowed) from Codeplug Studio.
- `src/core/domain/propagation/rayLinkBudget.ts` —
  `computeIllustrationRayBudget`, a per-ray link budget for
  `colourBy: 'signalStrength'`.
- `src/app/state/rayControls.ts` — `ViewerState.display.rayControls`.
- `src/app/components/HfPropagationGlobe/buildGlobeData.ts` —
  `buildRayPaths`/`RayGlobePath`, the globe's own ray rendering (wired in
  by this phase; the globe's rendering internals otherwise stay phase
  9's).

## Inputs

- `ViewerState.station`/`conditions`/`bandId`/`frequencyMhz`/`target` —
  read exactly like every other surface (no Explore-specific scenario
  object).
- `ViewerState.display.rayControls` — `radials` (1–16), `elevations`
  (1–10 per radial), `elevationSpreadDeg`, `focusBearingDeg` (used only
  when `target` is null), `outcomeFilter`, `colourBy`, `soloLayerId`.
  Registered with the URL codec (`src/app/lib/urlState/fields/explore.ts`)
  so a permalink reproduces the exact ray-view state.

## Behaviour

- **`mode: 'rose'`** (360° tiling) when no target is set; **`mode:
'fan'`** focused on the target's bearing when one is (a preview of
  Path's own F10.4 behaviour — Path itself is a later phase).
- **The cross-section's altitude axis uses a sqrt scale** (not linear or
  log) — a rendering judgment call, flagged in the component's own doc
  comment: linear crushes D/E (90/110km) against F2's own band
  (300–350km); log over-expands the low end.
- **D's band is gated on solar zenith angle directly**, not
  `LayerState.criticalFrequencyMhz` — D's critical frequency is always
  `null` (it is never a reflection candidate), so the naive filter the
  plan file originally sketched would never draw the D band at all. See
  `crossSectionLayerBands.ts`'s own doc comment.
- **Filtering/colour-by/solo never re-run the engine** — a direct
  acceptance criterion, enforced by `rayVisual.test.ts`'s spy-based
  invariant test (`generateIllustrationRays`/`computeCoverageGrid` spies,
  asserted un-called across every filter/colour/solo combination).
  `colourBy: 'signalStrength'` calling `computeIllustrationRayBudget`
  (which calls `computeLinkBudget`) is expected and bounded by the
  ≤160-ray ceiling — that is per-ray illustration enrichment, not a
  second grid sweep.
- **Layer soloing dims on the cross-section, hides on the globe** —
  judgment call, flagged: react-globe.gl's `pathsData` has no per-path
  opacity accessor, so a soloed-out ray is filtered out of the globe's
  ray list entirely rather than rendered faded.

## Known gaps

- Ray dash length/gap on the globe are computed from each ray's own
  great-circle arc length (`RayPoint.distanceAlongBearingKm`), the same
  fraction-of-path-length convention the terminator's fixed dash already
  uses — not a literal port of Codeplug Studio's `PropagationMode`-keyed
  table (this model has no groundwave-classified ray outcome and doesn't
  distinguish NVIS geometrically).
- "Colour by mode" (`ux-and-ia.md`'s own wording) is read as "colour by
  outcome" — `IllustrationRay` has no separate `mode` field distinct from
  `outcome`. Cheap to relabel later since it's presentation-only.

## Related

- [../engine/multihop-coverage-and-rays.md](../engine/multihop-coverage-and-rays.md) — `generateIllustrationRays`, the coverage-grid independence invariant.
- [../reach/globe.md](../reach/globe.md) — the globe's own rendering internals (shells, terminator, cutaway).
- Tracking issues: [#65](https://github.com/pskillen/rf-propagation/issues/65), [#68](https://github.com/pskillen/rf-propagation/issues/68).
