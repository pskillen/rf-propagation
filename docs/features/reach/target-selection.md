# Best band summary and target selection

## Purpose

The two remaining pieces of this phase: the best-band-now strip
(reach extremes + a per-band ranking) and cell-selection target
recording. See [coverage-surface.md](coverage-surface.md) for the map and
shading itself.

## Code anchors

- `src/app/components/reach/reachSummary.ts` — pure functions:
  `reachExtremes`, `formatReachExtremes`, `rankBandsByMeanReliability`.
- `src/app/components/reach/useBestBandNow.ts` — the per-band sweep hook
  (its own dedicated `CoverageGridClient`/Worker).
- `src/app/components/reach/ReachSummaryStrip.tsx` — the strip UI.
- `src/app/components/reach/formatLatLon.ts`,
  `src/app/lib/geo/bearingDistance.ts` — target display formatting.
- `src/app/components/reach/TargetPanel.tsx` — the same-surface target
  affordance (until Path, phase 13, exists).
- `src/app/lib/urlState/fields/target.ts`,
  `src/app/lib/urlState/types.ts` (`TargetUrlState`) — the URL codec
  registration.
- `src/app/state/viewerState.tsx` — `Target`/`TargetSource` types,
  `ViewerState.target`.

## Inputs

- The current band's already-computed `CoverageGridResult` (Slice 2/3) —
  reach extremes read this directly, no extra engine call.
- `Station`/`Conditions` (via `ViewerState`) — `useBestBandNow` re-sweeps
  on any change to either.
- Map `click` events (Leaflet's own, distinct from the marker's `drag`/
  `dragend` — the two don't conflict).

## Behaviour

### Reach extremes (current band)

`reachExtremes(result)` walks every cell, finds each `hopCount`
category's min/max populated `rangeBin` across all azimuths, and returns
one entry per category present (absent categories are simply missing,
not zero-filled). `formatReachExtremes` turns that into ux-and-ia.md's
own wording — "groundwave to X km, dead to Y km, first hop Y-Z km" — with
the "dead to Y" clause appearing only when there's a genuine gap between
groundwave's outer edge and hop 1's inner edge.

### Best band right now (all bands)

`useBestBandNow` runs a full `computeCoverageGrid` sweep once per band in
`UK_AMATEUR_BANDS` (sequentially, awaited — its client tracks one
in-flight request at a time), only re-triggered on Station/Conditions
change, never on a drag-frame. `rankBandsByMeanReliability` scores each
band by mean `reliability` over cells where `hopCount !== 255` — ignoring
the skip zone, so a band with a large skip zone isn't unfairly dragged
toward zero next to a band with a small one. This scoring formula isn't
specified anywhere in the design doc set — a documented judgment call,
not a derived spec value.

Every reliability figure shown carries its percentage (FR-9, "no bare
booleans") — the best-band line always reads e.g. "20 m, 100 percent
reliability," never a bare band name or a checkmark.

`useBestBandNow` owns its own `CoverageGridClient`, deliberately separate
from the live-drag surface's. `CoverageGridClient` cancels any in-flight
request when a new one starts; sharing one client between the drag-
recompute path and this sequential 10-band sweep would let either cancel
the other's in-flight result. The phase plan's "via the same Worker
client" is read here as "the same client mechanism," not literally one
shared instance.

### Cell selection sets a target

A map click (not drag) calls `onMapClick(lat, lon)` with Leaflet's own
`e.latlng` — no cell-index round-trip needed for the click itself.
`ReachPage` writes `ViewerState.target = { lat, lon, label: undefined,
source: 'map-click' }`. `TargetPanel` is the same-surface affordance F5.5
calls for ("until Path exists, surface the selection without a full Path
view"): it shows the target's coordinate (`formatLatLon`) plus bearing/
range from the station (`bearingDistance.ts`'s `initialBearingDeg`/
`haversineDistanceKm`), with a "Clear target" action that resets
`target` to `null`. No stub Path route is built for this.

`target` is registered with the URL codec (`targetFieldCodec`, `tlat`/
`tlon` only — `label`/`source` are lossy across a shared link, since
`source` is always `'map-click'` for anything this phase's own codec can
produce) per F3.3's own acceptance criterion that each surface adds its
own state to the codec as part of its own ticket.

Phase 13 (Path) completes this stub: setting `target` now switches the
answer surface to the full Path view (`activeAnswerSurface`) instead of
just showing `TargetPanel` in place — see
[../path/reach-path-switching.md](../path/reach-path-switching.md).
`TargetPanel` and the map's own target-marker drag support stay in the
code (harmless, and useful if a future direct Reach-with-a-target view
is ever added) but are effectively unreachable in the current UX, since
`ReachPage` unmounts the instant `target` becomes non-null.

## Open items

- No licence-class filtering: F5.4 says out-of-class bands shouldn't win
  "best band now," but no licence-class model exists anywhere in Station/
  Conditions yet — the same gap `BandChips.tsx` (phase 7) already flagged
  and made the same call about. All of `UK_AMATEUR_BANDS` is ranked
  unfiltered.
- No in-place term definitions (F8.4, phase 11) — the legend and strip
  use plain static text, not a popover glossary.

## Try it

1. On Reach, confirm the strip shows current-band reach extremes and a
   best-band ranking with a reliability percentage once both sweeps
   settle.
2. Click anywhere on the map (not the station marker) — a target panel
   appears with coordinate/bearing/range, and a second marker appears at
   the clicked point.
3. Click "Clear target" — the panel and marker disappear.
4. Change the band or edit Station/Conditions — the best-band ranking
   re-sweeps before it settles again.

## Related

- [coverage-surface.md](coverage-surface.md) — the map and shading this strip summarises.
- [../conditions/band-catalog.md](../conditions/band-catalog.md) — the licence-class gap's original flag.
