# HfPropagationGlobe

## Purpose

Renders Reach's 3D propagation globe (F6, phase 9) — D/E/F1/F2 ionospheric
shells as concentric translucent spheres (`customThreeObject` /
`customLayerData`), the coverage grid as a ground-shading texture, a
day/night terminator ring + sun marker, and a transmitter marker
(`pointsData`). Same [`react-globe.gl`](https://github.com/vasturiano/react-globe.gl)
stack as Codeplug Studio's sibling component of the same name (ported
from, reduced — see [Behaviour](#behaviour)).

## Props

| Prop                | Type                         | Notes                                                                                                                                                                           |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layers`            | `LayerState[]`               | From `layerStates()` (`@core/domain/propagation/layers`). All four shells (including D) render regardless of time of day — no per-layer visibility toggle exists in this phase. |
| `display`           | `ShellDisplayOptions`        | `{ exaggerationFactor, explodeEnabled, fresnelEnabled }`. `exaggerationFactor <= 1` is a no-op (true scale).                                                                    |
| `environmentAtMs`   | `number`                     | Optional. Instant for the night-side shade, greyline ring, and sun marker (Reach's throttled `Conditions.atMs` — see [Behaviour](#behaviour)).                                  |
| `terminatorEnabled` | `boolean`                    | Optional, default `false`. Dashed greyline ring + sun marker. Night-side shade stays on regardless, whenever `environmentAtMs` is set.                                          |
| `txLat` / `txLon`   | `number`                     | Transmitter WGS84 degrees — the marker position and the coverage ground-shade's bearing/range origin.                                                                           |
| `coverageResult`    | `CoverageGridResult \| null` | The same grid Reach's 2D map shades (`useReachCoverage`). `null` before the first response — no ground-shading layer is added until then.                                       |
| `cutawayEnabled`    | `boolean`                    | Optional, default `false`. Clips shell meshes along a vertical plane through the transmitter at `sliceBearingDeg`.                                                              |
| `sliceBearingDeg`   | `number`                     | Optional, default `0`.                                                                                                                                                          |

## Usage

```tsx
import { lazy, Suspense } from 'react';

const HfPropagationGlobe = lazy(
  () => import('../../components/HfPropagationGlobe/HfPropagationGlobe.tsx'),
);

<Suspense fallback={<div>Loading 3D globe…</div>}>
  <HfPropagationGlobe
    layers={layers}
    display={{ exaggerationFactor: 2.5, explodeEnabled: false, fresnelEnabled: true }}
    environmentAtMs={throttledConditions.atMs}
    terminatorEnabled
    txLat={station.qth.lat}
    txLon={station.qth.lon}
    coverageResult={result}
  />
</Suspense>;
```

Always lazy-loaded by its caller (`ReachPage.tsx`, gated behind the
map/globe `SegmentedControl`) — see
[`docs/features/reach/globe.md`](../../../../docs/features/reach/globe.md)
for how the app wires this in.

## Behaviour

Reduced scope vs. Codeplug Studio's `HfPropagationGlobe` — no traced rays
(`pathsData` ray entries), no skip-zone ring, no ray corridor, no
`MODE_COLORS`/mode legend (this repo has no `PropagationMode` type
surfaced to the app layer yet; illustration rays are phase 11's job), and
no per-layer D/E/F1/F2 visibility toggle (not one of this phase's four
Display controls). Adds Slice 3's coverage ground-shading texture, which
Studio's globe has no equivalent of.

- **Sizing:** measures its own container via `ResizeObserver`, passing
  explicit `width`/`height` to `Globe` (`react-globe.gl` otherwise
  defaults to the _window's_ size).
- **Shells:** one `THREE.Mesh` (unit-radius `SphereGeometry`, semi-transparent
  `MeshBasicMaterial`) per layer, always all four. Colour is
  `colorForLayer(id)` (`@core/domain/propagation/layerColor`); baseline
  opacity steps outward from D `0.28` by `0.05` per layer. `renderOrder`
  paints outer first, inner last (`F2 -> D`) so D/E are not buried — all
  shells share the globe origin, so Three's transparent distance-sort is
  insertion-order-unstable without this.
- **Radius does NOT vary spatially with day/night** (a deliberate
  reduction from Studio's globe, flagged in `buildGlobeData.ts`'s own doc
  comment) — this repo's `LayerState.virtualHeightKm` is a single
  Conditions-snapshot number, not two engine-exported day/night altitude
  constants per layer the way Studio's `layerMidAltitudeKm` was. Only
  per-fragment **opacity** fades with local sun angle
  (`shellPresence`/`dLayerPresence`/`dayNightFactor` in
  `buildGlobeData.ts`, ported verbatim — pure cosmetic geometry, not
  physics) — D and F1 still visibly fade out on the night hemisphere.
- **Display controls** (`display` prop): altitude exaggeration
  (`exaggeratedAltitudeKm`, 1x-10x, factor <= 1 is a no-op), exploded
  stacking (`explodeOffsetUnits`, canonical `D=0...F2=3` so hidden/inactive
  layers do not jump when toggled), Fresnel shading (per-fragment opacity
  `mix(0.05, 0.40, pow(1 - |N.V|, 2))`, `MeshBasicMaterial.onBeforeCompile`,
  pushed every animation frame via a `requestAnimationFrame` loop since
  `customThreeObjectUpdate` only runs on data changes, not every frame).
- **Day/night terminator:** `computeSubsolarPoint`/`computeSolarTerminator`
  (`@core/domain/propagation/solarTerminator`, phase 8a) feed
  `buildTerminatorPaths` (a dashed `pathsData` ring, split at the
  antimeridian) and `buildSunMarkerMesh` when `terminatorEnabled`; a
  `buildNightShadeMesh` overlay is always on whenever `environmentAtMs` is
  set, independent of `terminatorEnabled`.
- **Cutaway plane:** `buildCutawayClippingPlane`
  (`@core/domain/propagation/cutawayPlane`) sets `THREE.Plane`s on the
  existing shell materials' `clippingPlanes` (`renderer.localClippingEnabled`
  set once) — does not recreate geometry/materials.
- **Coverage ground-shading (Slice 3, F6.3):** one more `customLayerData`
  entry — a thin sphere at ground radius whose fragment shader converts
  each fragment's position to (bearing, range) from the transmitter
  (`reachGreatCircleBearingDeg`/`reachGreatCircleRangeKm`, the GLSL
  equivalent of `bearingDistance.ts`'s `initialBearingDeg`/
  `haversineDistanceKm` — "the exact inverse of phase 8 Slice 2's
  cell -> coordinate projection", per this phase's plan file) and samples a
  `THREE.DataTexture` built from `cellFillStyle` (Reach's 2D map's exact
  hue/opacity scheme — `buildCoverageTextureData` bakes RGBA bytes
  directly, one texel per grid cell, rather than encoding raw
  `hopCount`/`reliability` for a shader-side colour lookup, so the two
  surfaces cannot visually drift from each other and the mapping stays
  unit-testable without a WebGL context). **One mesh, one texture, updated
  in place** on every new coarse/fine grid result — react-globe.gl (via
  `three-globe`'s d3-style data join) tracks `customLayerData` entries by
  array position, so this entry stays at the same index across renders and
  `customThreeObjectUpdate` (not `customThreeObject`) runs on every
  subsequent update, rewriting the texture's bytes rather than rebuilding
  the mesh.
- **`GLOBE_RADIUS_UNITS = 100`:** `three-globe`'s own internal scene-unit
  globe radius (pinned copy, not exported by the package).

## Testing

`react-globe.gl` needs a WebGL context jsdom doesn't provide, so
`HfPropagationGlobe.test.tsx` mocks it to a stub component and asserts the
`customLayerData`/`pathsData`/`pointsData` props it receives (all four
shells always present, night-shade only with `environmentAtMs`, sun
marker/terminator path only with `terminatorEnabled` too, exactly one
coverage-ground entry only when `coverageResult` is set, cutaway adds no
extra entries). Mesh/shader/texture math (shell radius, day/night
presence, terminator antimeridian split, the coverage texture's hue/opacity
parity with `cellFillStyle`, and the "update in place, don't recreate the
mesh" contract) lives in `buildGlobeData.test.ts`. Cutaway-plane geometry:
`cutawayPlane.test.ts`. Terminator/subsolar correctness itself: phase 8a's
`solarTerminator.test.ts` (not duplicated here, per this phase's plan
file).

## Related

- [Reach feature docs](../../../../docs/features/reach/README.md)
- [`docs/features/reach/globe.md`](../../../../docs/features/reach/globe.md) — product-level behaviour, Display panel, map/globe toggle
- [`docs/features/reach/coverage-surface.md`](../../../../docs/features/reach/coverage-surface.md) — the `cellFillStyle` hue/opacity scheme this component reproduces exactly
