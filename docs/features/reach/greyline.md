# 2D greyline (day/night terminator)

## Purpose

The terminator line, subsolar-point (sun) marker, and best-effort
night-shading polygon on Reach's 2D Leaflet map, plus the local toggle
that shows/hides them. Shipped in `fix/reach-directionality-antenna-
greyline`, inserted between phase 8 and phase 9 — the astronomy this
slice ports is the same module phase 9 (Globe) was going to port
separately; phase 9 now imports it instead. Not covered here: the
coverage-grid shading itself — see
[coverage-surface.md](coverage-surface.md).

## Code anchors

- `src/core/domain/propagation/solarTerminator.ts` — `computeSubsolarPoint(atMs): GeoPoint`,
  `computeSolarTerminator(atMs, pointCount = 180): GeoPoint[]` (a closed
  ring at exactly 90° solar zenith angle). Pure astronomy, no rendering
  types — ported from Codeplug Studio's `solarTerminator.ts`, adapted
  from mk1's `[lat, lon]` tuple (`LatLon`) to this repo's own `GeoPoint`
  object convention. Built on `solarZenithAngle.ts`'s `solarGeometryAt`
  (already in this repo, phase 3).
- `src/app/components/reach/TerminatorLayer.tsx` — the map-rendering
  consumer: a dashed `Polyline` for the terminator, a `CircleMarker` for
  the sun, and a best-effort night-shading `Polygon`.
- `src/app/components/reach/ReachMap.tsx` — mounts `TerminatorLayer`
  (declarative react-leaflet components, no custom `L.Layer` subclass
  needed — unlike `CoverageCanvasLayer`, Leaflet already has first-class
  `Polyline`/`Polygon`/`CircleMarker` wrappers) given `atMs` and
  `showTerminator`.
- `src/app/routes/reach/ReachPage.tsx` — owns the `showTerminator`
  local toggle state (default **on**) and renders a `ToggleSwitch` in
  Reach's own controls column.

## Behaviour

### Terminator line + sun marker

`computeSolarTerminator(conditions.atMs)` recomputes on every
`conditions.atMs` change (cheap — a ~180-point ring, same order of cost
as generating it in the first place; no debounce beyond whatever cadence
`conditions.atMs` already updates at). Rendered as a dashed amber
`Polyline`. `computeSubsolarPoint(conditions.atMs)` renders as a small
filled `CircleMarker`, styled distinctly from the station/target
markers (white ring, amber fill, vs. the station's red dot and the
target's blue ring).

### Antimeridian handling

`computeSolarTerminator`'s ring normalises each point's raw longitude
independently, so two geographically-close ring points can land on
opposite sides of the ±180° seam even though the ring sweeps smoothly —
the same problem `coverageCellProjection.ts`'s cell corners already
solve. `TerminatorLayer.tsx`'s `unwrapRingLongitudes` unwraps each
point relative to the **previous** point (not one fixed reference),
using the existing `unwrapLongitudeRelativeTo` — this keeps the
polyline continuous in Leaflet's linear-beyond-±180° longitude
projection regardless of where the ring happens to start.

### Night-shading polygon

The terminator (a great circle) is single-valued in longitude, so the
already-unwrapped ring traces one continuous curve across a full 360°
span. `buildNightPolygonPositions` closes that curve into a polygon by
adding two vertices at whichever **pole is currently in darkness**
(`solarZenithAngleDeg(±90, 0, atMs) > 90`), each at that pole's own end
of the ring's unwrapped longitude range — bounding exactly the night
hemisphere in this projection. The closing latitude is capped at ±85°
(`POLE_CAP_LAT_DEG`), one degree inside the standard Web Mercator tile
layer's own ~85.0511° cutoff, since the true pole is a singularity in
that projection. Returns `null` (fill omitted, line + marker still
render) at the rare near-exact-equinox instant where neither pole is
unambiguously in night — this slice's own explicit fallback for the
"fiddlier half" of the greyline work, rather than guessing which side
to shade.

This worked out robustly in both automated testing (`TerminatorLayer.test.tsx`
checks the closing-pole sign at both solstices) and real-browser
verification, so it shipped rather than being deferred as the plan file's
own fallback allowed.

### Toggle

A `ToggleSwitch` in Reach's own controls column (`ReachPage.tsx`), not a
global display-toggle registry — phase 10 hasn't built that yet, and
this is one boolean local to one surface. Defaults **on**: most
operators are on the 2D map (the mobile default) and were seeing none
of this before this slice.

## Manual verify

```sh
npm run dev
```

- Open Reach — a dashed amber line and a small amber sun marker should
  render on the map immediately (toggle defaults on).
- A darker tint should cover the night-side hemisphere, following the
  terminator line's own shape.
- Untick "Greyline (day/night terminator)" in the controls column — all
  three (line, marker, shading) disappear together.
- Scrub Conditions' time forward several hours (if the scrub control is
  wired) — the terminator/sun marker should visibly move east-to-west
  with the clock.

## Known gaps

- **No globe equivalent yet** — phase 9 (Globe) reuses
  `solarTerminator.ts` for its own 3D rendering, not built by this
  slice.
- **The night-shading polygon assumes a single terminator crossing per
  meridian** — true for the real terminator (a great circle intersects
  every meridian once), but if a future change made the ring
  non-single-valued in longitude, this polygon-closing technique would
  need revisiting.
- **Not part of a global display-toggle registry** — phase 10, if it
  builds one, can absorb this toggle or leave it as-is; that's phase
  10's own call.

## Related

- [coverage-surface.md](coverage-surface.md) — the coverage-grid shading this map also renders.
- [README.md](README.md) — feature hub, implementation status.
- [../engine/geometry-and-layers.md](../engine/geometry-and-layers.md) — `solarZenithAngleDeg`/`solarGeometryAt`, this slice's own astronomy foundation.
