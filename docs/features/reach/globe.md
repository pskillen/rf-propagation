# 3D globe (F6, phase 9)

## Purpose

Reach's second view: a `react-globe.gl`/`three.js` globe rendering the
D/E/F1/F2 ionospheric shells, the same coverage grid the 2D map shades
(as a ground texture), and a day/night terminator — plus a Display panel
for shell exaggeration/explode/Fresnel/cutaway and the map/globe view
switch itself. Ported (reduced) from Codeplug Studio's
`HfPropagationGlobe`, per `new-app-migration.md`'s "port as-is" list.
Not covered here: the coverage-grid shading data itself, or the 2D map's
own greyline — see [coverage-surface.md](coverage-surface.md) and
[greyline.md](greyline.md).

**What this phase does NOT do** (deferred to later phases, per its own
plan file): no traced illustration rays on the globe (phase 11,
Explore), no skip-zone ring (the skip zone is a hop-band colour in the
ground texture, not a separate ring), no transport-control widget (phase
10), no per-layer D/E/F1/F2 visibility toggle, no deep mobile 3D
performance tuning.

## Code anchors

- `src/app/components/HfPropagationGlobe/HfPropagationGlobe.tsx` — the
  `react-globe.gl` component, lazy-loaded by `ReachPage.tsx`. Sidecar
  doc: [`HfPropagationGlobe.md`](../../../src/app/components/HfPropagationGlobe/HfPropagationGlobe.md)
  (props, behaviour, testing — read that first for anything below this
  product-level summary).
- `src/app/components/HfPropagationGlobe/buildGlobeData.ts` — shell
  mesh/shader math, day/night presence, cutaway clipping, the day/night
  terminator paths, and the coverage ground-shading `THREE.DataTexture`
  builder (`buildCoverageTextureData`/`buildCoverageGroundMesh`).
- `src/app/components/HfPropagationGlobe/viewportOffset.ts` — Slice 4's
  `camera.setViewOffset` mechanism.
- `src/app/components/HfPropagationGlobe/GlobeDisplayPanel.tsx` — the
  Display panel (Slice 2): exaggeration slider, explode/Fresnel/
  terminator/cutaway toggles.
- `src/app/state/globeToggles.ts` — `GlobeToggles` (the six
  `ViewerState.display.globeToggles` fields) and its defaults.
- `src/app/lib/urlState/fields/globe.ts` — the URL codec field
  (`gx`/`ge`/`gf`/`gt`/`gc`/`gm` params).
- `src/app/routes/reach/ReachPage.tsx` — the map/globe `SegmentedControl`
  ("View" panel), mounts either `ReachMap` or (lazily) `HfPropagationGlobe`
  into `SurfaceLayout`'s `canvas` slot, and computes the `LayerState[]`/
  cutaway bearing the globe needs.
- `src/app/components/reach/buildCoverageGridInput.ts` —
  `computeLayerStates`, pulled out of `buildCoverageGridInput` so the
  globe's shells and the coverage grid always agree on what the
  ionosphere is doing right now (one computation, not two).
- `src/core/domain/propagation/layerColor.ts` /
  `src/core/domain/propagation/cutawayPlane.ts` — ported shell-colour
  palette and cutaway-plane geometry (pure, no three.js types).

## Inputs

- `LayerState[]` (`computeLayerStates`, phase 2's `layerStates`) — same
  station/Conditions-derived snapshot the coverage grid itself uses.
- `CoverageGridResult | null` — the same `useReachCoverage` result the
  2D map shades; switching views does not trigger a second Worker
  compute (see [Behaviour](#view-switching-preserves-state)).
- `Conditions.atMs`, throttled the same way the 2D greyline's is (see
  [greyline.md](greyline.md)) — drives the subsolar point, terminator
  ring, and night-side shade.
- `ViewerState.display.globeToggles` — persisted, URL-encoded Display
  settings (see [Behaviour](#display-panel-and-persistence)).
- The active antenna's `azimuthDeg` (when `family === 'directional-lobe'`,
  else `0`) — the cutaway plane's default bearing.

## Behaviour

### Shells

All four shells (D, E, F1, F2) always render — there is no per-layer
visibility toggle in this phase. The day/night **opacity** fade (D and
F1 dim toward the night hemisphere, E dims less, F2 stays) is computed
per-fragment from the local sun angle (`shellPresence` in
`buildGlobeData.ts`), independent of the engine's `LayerState` entirely.

**Shell radius does not vary spatially with day/night** — a deliberate
reduction from Codeplug Studio's own globe (flagged in
`buildGlobeData.ts`'s own header). Studio's globe interpolates each
shell's radius between a day and a night mid-altitude
(`layerMidAltitudeKm(id, isNight)`); this repo's `LayerState.virtualHeightKm`
is a single Conditions-snapshot number (the "uniform ionosphere" tier —
see the engine's own `coverageGrid.ts` header), not two engine-exported
day/night altitude constants per layer. Inventing a second altitude
model outside the engine to recover that effect would be in tension with
this phase's "no engine code changes" invariant, so shell radius reflects
the current Conditions snapshot uniformly across the whole globe.

### Coverage ground-shading texture

One more mesh — a thin sphere at ground radius — samples a
`THREE.DataTexture` built from the current `CoverageGridResult`, using
**the exact same `cellFillStyle` hue/opacity scheme** the 2D map's
`CoverageCanvasLayer` uses (hue by `hopCount`, opacity by `reliability`,
zero fill for the skip zone). The fragment shader converts each
fragment's position to (bearing, range) from the transmitter — the GLSL
equivalent of `bearingDistance.ts`'s `initialBearingDeg`/
`haversineDistanceKm`, i.e. the inverse of the 2D map's own
cell-to-coordinate projection — and samples the texture at that cell.

**One mesh, one texture, updated in place** on every new coarse/fine
grid result (never rebuilt) — see the sidecar doc's
[Behaviour](../../../src/app/components/HfPropagationGlobe/HfPropagationGlobe.md#behaviour)
section for how react-globe.gl's positional data-join makes that hold.

### View switching preserves state

`ReachPage.tsx` owns `useReachCoverage`'s `result`/`pass` and Station/
Conditions state above both views — switching `globeToggles.mapMode`
only changes which component reads `SurfaceLayout`'s `canvas` slot, it
never re-triggers a Worker compute or resets Station/Conditions. Covered
by `ReachPage.globeToggle.test.tsx` (asserts the Worker's `postMessage`
count is unchanged across a map → globe → map round trip).

### Display panel and persistence

`GlobeDisplayPanel` exposes altitude exaggeration (1×–10×, continuous
`onChange`, not `onChangeEnd` — the standing FR-27/FR-28 constraint),
exploded stacking, Fresnel shading, the day/night terminator, and the
cutaway plane. All six `globeToggles` fields (including `mapMode`)
persist through `ViewerState.display.globeToggles` and round-trip
through the URL codec (`gx`/`ge`/`gf`/`gt`/`gc`/`gm`).

**`ViewerState.display` originates in this phase, not phase 10** — a
stale doc comment on `ViewerState` (written during phase 5) said
`display` would be added by phase 10; phase 9's own plan file explicitly
calls for `display.globeToggles` here, so this phase adds the field and
corrects that comment. See `viewerState.tsx`'s own doc comment for the
full reasoning.

### Viewport offset

Slice 4 closes out mk1 tranche-2's H1 carryover requirement (never
shipped in mk1 — this phase invents the mechanism). Uses
`camera.setViewOffset` on the globe's underlying `THREE.PerspectiveCamera`,
recomputed on every resize. **Shift direction is mirrored from mk1's own
illustration**: mk1's own control panel sat on the right of a full-bleed
canvas ("shifted left, giving the right-hand control panel room"); this
app's `SurfaceLayout` puts Reach's panel on the **left** instead (a
grid column, not an overlay), so the globe's apparent centre shifts
**right** within its own canvas here. Degrades to 0 below the mobile
breakpoint (`768px`, matching `breakpoints.ts`'s existing
`MOBILE_MAX_WIDTH_MEDIA_QUERY`).

### Map/globe view switch and mobile fallback

A `SegmentedControl` ("View" panel) in Reach's controls column, backed
by `globeToggles.mapMode`. Defaults to `'map'` everywhere (not just on
phones) — `HfPropagationGlobe` stays lazy-loaded regardless, so the
`three`/`react-globe.gl` bundle is never fetched unless the operator
explicitly switches to Globe. Choosing Globe on a phone is a supported
opt-in (verified manually at 360×640 — the globe renders and is
pannable/zoomable by touch), not blocked; deep mobile 3D performance
tuning is out of scope for this phase (Explore, phase 11, owns that).

## Manual verify

```sh
npm run dev
```

- Open Reach (defaults to the 2D map) — the "View" panel shows Map/Globe.
- Switch to Globe — shells (D/E/F1/F2, translucent concentric spheres)
  and the coverage ground-shading (concentric hop-band colours around
  the station) should render with no console errors.
- Drag the "Altitude exaggeration" slider — shell radii should update
  continuously while dragging, not just on release.
- Toggle "Exploded layer stacking" — shells should visibly separate.
- Toggle "Day/night terminator" — a dashed line and sun marker should
  appear; the night hemisphere should read darker regardless.
- Toggle "Cutaway plane" — shells should clip along a vertical plane
  through the station.
- Switch back to Map — the same coverage shading should still be there
  (no "Computing coverage…" flash — confirms no re-compute happened).
- Resize the window down to ~360px wide — the Display panel stacks above
  the canvas; the globe should still render and be pannable by touch.

## Known gaps

- **No traced rays, skip-zone ring, or ray corridor** — phase 11
  (Explore) is the first consumer of `generateIllustrationRays` on this
  globe.
- **No per-layer D/E/F1/F2 visibility toggle.**
- **Shell radius does not vary spatially with day/night** — see
  [Behaviour](#shells) above.
- **The transport control widget** (play/pause/speed/scrub) does not
  exist yet — phase 10. This phase's controls already respond
  continuously; only the discrete widget is missing.

## Related

- [README.md](README.md) — feature hub, implementation status.
- [coverage-surface.md](coverage-surface.md) — the `cellFillStyle`
  hue/opacity scheme this globe reproduces exactly.
- [greyline.md](greyline.md) — the 2D map's own terminator/sun marker,
  built on the same `solarTerminator.ts` module.
- [`HfPropagationGlobe.md`](../../../src/app/components/HfPropagationGlobe/HfPropagationGlobe.md) —
  component-level props/behaviour/testing sidecar.
- Tracking: [Feature #8 "Globe and ionospheric shells"](https://github.com/pskillen/rf-propagation/issues/8)
- Task issues: [#54](https://github.com/pskillen/rf-propagation/issues/54)–[#57](https://github.com/pskillen/rf-propagation/issues/57), [#62](https://github.com/pskillen/rf-propagation/issues/62)
- Reference source (read-only, not linked from committed docs per
  [AGENTS.md](../../../AGENTS.md)): Codeplug Studio's
  `src/app/components/HfPropagationGlobe/*`,
  `src/app/components/SatelliteGlobe/globeAltitude.ts`.
