# Multi-hop solving, coverage grid, illustration rays, and the Worker

## Purpose

Closes out the engine (F2). Covers three new code paths through the
already-validated physics (phase 2's geometry/layers/reflection, phase 3's
link budget/reliability), plus the Worker that carries the heaviest of them
off the main thread:

1. **Multi-hop path solving** (`multiHop.ts`) — given a known target ground
   distance (Path mode's question), which hop count and reflecting layer
   gets a signal there at all, and which is best?
2. **Coverage grid** (`coverageGrid.ts`) — the opposite direction: a dense
   forward sweep over azimuth × elevation that bins every hop's landing
   point into a ground cell, so the groundwave disc, skip zone, and hop-N
   bands fall out of the data.
3. **Illustration rays** (`illustrationRays.ts`) — a small, operator-sized
   set of full point-by-point polylines for rendering, decoupled from the
   coverage grid by construction.
4. **The coverage-grid Worker** (`src/integrations/propagation/`) — carries
   the sweep off the main thread, results crossing as transferable typed
   arrays, with cancellation and a coarse-then-fine two-pass.

Product-level framing is in the [engine hub](README.md). **This phase adds
no UI** — Reach (phase 8) is the first surface to call any of this.

**The property every later UI phase binds to:** the coverage grid and the
illustration rays are separate concerns, computed by separate code paths,
at separate resolutions. Ray count is an operator/rendering control (≤16
radials × ≤10 elevations); grid resolution is fixed (72 azimuths × 90
elevations × up to 4 hops). Changing one never changes the other's output —
see [Behaviour](#illustration-rays) below for how that's enforced.

## Code anchors

| Module                                                                                                                                | Exports                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/domain/propagation/multiHop.ts`                                                                                             | `HopSolution`, `HopSolveResult`, `SolveHopsContext`, `solveHopsForDistance`                                                                                                                                                     |
| `src/core/domain/propagation/coverageGrid.ts`                                                                                         | `COVERAGE_AZIMUTH_COUNT`, `COVERAGE_ELEVATION_COUNT`, `COVERAGE_MAX_HOPS`, `COVERAGE_RANGE_BIN_KM`, `COVERAGE_RANGE_BIN_COUNT`, `CoverageGridInput`, `CoverageGridResult`, `computeCoverageGrid`, `computeCoverageGridAtStride` |
| `src/core/domain/propagation/illustrationRays.ts`                                                                                     | `RayPoint`, `RayOutcome`, `IllustrationRay`, `GenerateIllustrationRaysInput`, `generateIllustrationRays`                                                                                                                        |
| `src/core/domain/propagation/greatCircle.ts`                                                                                          | `GeoPoint`, `destinationPoint` — shared great-circle navigation helper                                                                                                                                                          |
| `src/integrations/propagation/protocol.ts`                                                                                            | `CoverageGridWorkerRequest`, `CancelWorkerRequest`, `CoverageGridWorkerMessage`, `CoverageGridWorkerResponse`                                                                                                                   |
| `src/integrations/propagation/coverageWorkerHandler.ts`                                                                               | `createCoverageWorkerHandler` (the worker's pure, testable message-handling logic)                                                                                                                                              |
| `src/integrations/propagation/coverageWorker.ts`                                                                                      | Real Worker entry point (thin adapter over `coverageWorkerHandler.ts`)                                                                                                                                                          |
| `src/integrations/propagation/coverageGridClient.ts`                                                                                  | `CoverageGridClient`, `WorkerLike`                                                                                                                                                                                              |
| `multiHop.test.ts`, `coverageGrid.test.ts`, `illustrationRays.test.ts`, `coverageWorkerHandler.test.ts`, `coverageGridClient.test.ts` | Slice-level correctness tests (below)                                                                                                                                                                                           |

`multiHop.ts`, `coverageGrid.ts`, `illustrationRays.ts`, `greatCircle.ts`
live in `src/core/domain/propagation/` — pure functions, no React/DOM/Worker
(enforced by the `src/core/**` ESLint layer-boundary rule). The Worker
files live in `src/integrations/propagation/`, matching phase 1's
layer-boundary rule (`core` stays platform-free, `integrations` owns
Worker/network/storage glue).

## Inputs

`solveHopsForDistance(groundRangeKm, frequencyMhz, layers, context)` takes
a known target distance and a `SolveHopsContext` (SSN, ground type, noise
environment, TX power/gain, RX gain, bandwidth, and a
`solarZenithAtMidpointDeg(hopIndex, hopCount)` callback, since a real
multi-hop path's later hops sit at different points on the Earth).

`computeCoverageGrid`/`computeCoverageGridAtStride` and
`generateIllustrationRays` both take a `CoverageGridInput`: station
lat/lon/time, frequency, `layers` (**one** evaluation at the station, per
physics-and-fidelity.md §7's "uniform ionosphere" tier), SSN, TX
power, TX antenna, RX gain, ground type, noise environment, bandwidth.

**`txAntenna` (changed from a flat `txAntennaGainDbi: number` in
`fix/reach-directionality-antenna-greyline`):** the whole
`AntennaConfig`, not just its nominal gain. Both `coverageGrid.ts`'s
per-cell sweep and `illustrationRays.ts`'s per-ray-point trace now call
`elevationGainDbi(txAntenna, elevationDeg, azimuthDeg, frequencyMhz)`
at the elevation/azimuth already in scope, instead of passing the same
flat number to every cell/point regardless of the antenna's actual
pattern. `rxAntennaGainDbi` stays a flat `number` — scoped to TX only,
see [../station/antenna-model.md](../station/antenna-model.md) and
[../reach/coverage-surface.md](../reach/coverage-surface.md#directionality).
`computeLinkBudget`'s own `LinkBudgetInput.txAntennaGainDbi` signature
is unchanged — this only changes what value `CoverageGridInput`'s
callers compute before calling it.

## Behaviour

### Multi-hop path solving

Searches hop counts 1–5 across the E/F1/F2 candidate layers. For each
`(hopCount, layer)` pair, `takeoffAngleForGroundRangeRad` (phase 2) gives
the takeoff angle that closes that hop count over the target distance;
`selectReflectingLayer` then **confirms** the requested layer actually
reflects at that geometry — a candidate is invalid if a lower layer would
intercept first, or the wave would escape. Distances beyond any achievable
geometry return `{kind: 'unreachable'}` (not silently clamped — a direct
ticket acceptance criterion). The winning candidate is the one with the
**lowest total loss** (FSPL + absorption + ground reflection +
polarisation) — equivalently highest SNR, since frequency/noise
environment/bandwidth are fixed inputs, so the noise floor is identical
across candidates. See [Deviations](#deviations) for why this doesn't
always reproduce phase 3's anchor hop counts literally.

### Coverage grid

Sweeps 72 azimuths (5° steps) × 90 elevations (1° steps, 0–89°) × up to 4
hops, tracing each ray with the launch elevation held constant per hop
(the phase's own simplifying assumption). Each hop's landing point is
binned into a `(azimuth, rangeBin)` cell, keyed on the **best** reliability
landing there across every elevation/hop that reaches it. A cell with no
landing anywhere in the sweep _is_ the skip zone — no special-casing.

- **Range bins:** 50km wide (`COVERAGE_RANGE_BIN_KM`), sized to
  `COVERAGE_MAX_HOPS × 4000km` (V3's single-hop ceiling) →
  `COVERAGE_RANGE_BIN_COUNT` = 320 bins. Not specified numerically by the
  design doc — this phase's own call, flagged per its own instruction.
- **Groundwave disc:** frequency- and ground-type-dependent range
  (monotonically decreasing with frequency; sea longest, land shortest),
  filled at reliability 1.0 / a fixed 40dB SNR placeholder / `hopCount: 0`.
  **Uncalibrated** — physics-and-fidelity.md gives no groundwave formula,
  only a critique that mk1's fixed 300km was wrong by 10×. Nothing in
  V1–V23 or the VOACAP goldens covers this; only a human looking at the
  rendered picture (phase 8) would catch a bad choice here.
- **Reliability's reference mode:** `CoverageGridInput` has no `mode` field
  (Station/Conditions and any mode selector don't land until phases 6–8),
  so `reliability` is computed via `modeVerdict(..., 'ssb')` — SSB as an
  implicit reference, the same convention `validation.test.ts`'s V16/V17
  single-point checks already use. Raw `snrDb` (unconverted `snrDb2400`) is
  stored per cell too, so a later mode selector can recompute its own
  bucket without needing this grid's shape to change.
- **Spatial variation:** each hop's own midpoint (great-circle projected
  from the station along that azimuth, via `greatCircle.ts`) gets its own
  solar zenith angle for absorption purposes — this is what produces
  greyline-like variation across the shaded grid, even though the layer
  critical frequencies themselves are one uniform station-wide snapshot.
- **Hot-loop allocation:** the sweep reuses one `Hop[]` buffer across every
  `(azimuth, elevation)` trace rather than reallocating per iteration, and
  writes directly into pre-allocated `Float32Array`/`Uint8Array` output
  buffers — no intermediate `CoverageCell[]`. It still allocates a `Hop`
  object per hop and a `LinkBudgetResult` per `computeLinkBudget` call,
  reusing phase 3's functions as the correctness source of truth rather
  than inlining the formulas allocation-free. See
  [Known gaps](#known-gaps).

### Illustration rays

`generateIllustrationRays` traces up to `radialCount` (≤16) ×
`elevationCount` (≤10) rays — `'rose'` tiles the full 360° (Reach),
`'fan'` tiles a focused arc around a bearing (Path) — reusing the exact
same per-hop physics as the coverage grid (`selectReflectingLayer` +
`computeLinkBudget`) but producing a renderable polyline instead of a
binned cell. Each `RayPoint` carries both a flat
`distanceAlongBearingKm`/`altitudeKm` pair (phase 11's cross-section) and
`latDeg`/`lonDeg` (phase 9's globe overlay).

**Outcome classification** reuses `computeLinkBudget`'s real SNR rather
than inventing a separate heuristic:

| Outcome    | Meaning                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `escaped`  | The wave never reflects at all (`selectReflectingLayer` returns `'escaped'` on the first hop).                                                                      |
| `absorbed` | The wave reflects and returns to ground, but cumulative SNR (`snrDb2400`) has dropped below 0 by that landing — geometrically back, signal gone. Trace stops there. |
| `returned` | The wave reflects and stays above the noise floor for every hop it traces (up to `COVERAGE_MAX_HOPS`).                                                              |

**Coverage-grid independence (the critical property):** this module never
imports `computeCoverageGrid`/`computeCoverageGridAtStride` and shares no
mutable state with `coverageGrid.ts` — enforced by construction, not
convention. `illustrationRays.test.ts` checks it directly: calls
`computeCoverageGrid` once, generates rays at two different radial/
elevation counts, calls `computeCoverageGrid` again, and diffs the typed
arrays.

### The Worker

`protocol.ts` defines the id-correlated request/response shape, ported
**in shape** from Codeplug Studio's `hfPropagation/protocol.ts` (not its
payload). `coverageWorkerHandler.ts` holds the actual message-handling
logic as a plain function — deliberately separate from `coverageWorker.ts`
(the real `self.onmessage` entry point) so it's directly unit-testable
without a real Worker thread (jsdom has none).

- **Coarse-then-fine:** each `computeCoverage` request runs
  `computeCoverageGridAtStride` at half azimuth/elevation resolution
  first (quartering the total work), posts `{pass: 'coarse'}`
  immediately, then continues to full resolution and posts
  `{pass: 'fine'}` for the same `requestId`.
- **Cancellation:** a `Set<number>` of cancelled request ids, checked once
  per traced azimuth row inside the sweep — not every hop iteration
  (wasteful) and not only at the end (too coarse to save real work).
- **Transferables:** `CoverageGridResult`'s three typed arrays cross as
  transferables (`.buffer`s passed as `postMessage`'s second argument),
  not structured-cloned — confirmed by a test using a real `MessageChannel`
  and checking `byteLength === 0` on the sender's buffers afterward, not
  just that the fields are typed arrays.
- **`CoverageGridClient`** (ported in shape from Studio's `RayTraceClient`,
  not unmodified — Studio's mk1 has no real cancellation) tracks at most
  one "current" request; starting a new one synchronously cancels and
  rejects the previous, which is what gives rapid successive requests
  (a slider drag) exactly one surviving fine result.

## Deviations

- **Anchor A/B hop counts don't reproduce literally.** Phase 3's
  calibration anchors hand-pick a takeoff angle and reflecting layer
  directly (`buildAnchorHop` in `validation.test.ts` never calls
  `selectReflectingLayer`). This phase's own instruction is to validate
  every candidate through `selectReflectingLayer` rather than assume the
  requested layer holds — doing that honestly shows the E layer actually
  intercepts and reflects 14MHz at the shallow angles a 1-hop-to-3360km or
  2-hop-to-5000km F2 path would need (E's own MUF, at that same shallow
  angle over its own 110km virtual height, is comfortably above 14MHz
  there — the same large-secant-at-grazing-incidence behaviour V2 already
  validates as correct, not a bug). The honestly-validated search resolves
  3360km to **2** F2 hops and 5000km to **3** F2 hops — one hop more than
  each anchor's hand-picked figure. Documented in `multiHop.ts` and
  `multiHop.test.ts`'s headers; same class of "the plan's worked figure
  doesn't survive the model's own formulas" deviation as V2/V4, the
  Anchor A/B absorption ratio, and V18 (all phase 2/3 precedents).
- **`computeCoverageGridAtStride` is an additional export.**
  `computeCoverageGrid`'s own signature is unchanged from the phase plan
  (still the only entry point phase 8 depends on). The stride variant is
  internal-only Worker plumbing for Slice 5's coarse pass, strictly
  additive.
- **`CancelWorkerRequest`/`CoverageGridWorkerMessage` are additions to the
  protocol.** `CoverageGridWorkerRequest` itself is unchanged from the
  phase plan's literal Slice 4 snippet.
- **Slices 4 and 5 landed in one commit**, not two. The coarse-then-fine
  two-pass and cancellation share the same sweep loop and message handler
  — building a single-pass, non-cancellable intermediate version first
  and then rewriting it wouldn't have produced a meaningful checkpoint.
  Both slices are fully implemented and tested; this is a commit-
  granularity note, not a functional gap.

## Manual verify

```bash
npm run test -- multiHop coverageGrid illustrationRays coverageWorkerHandler coverageGridClient greatCircle validation
```

All suites should pass; `validation.test.ts` (V1–V23) still gates CI
unchanged — this phase adds no new numbered validation checks of its own
(F2.11–F2.15 are architecture/plumbing), but Slices 1 and 2 each have
dedicated correctness tests reproducing V16/V17/V18/Anchor A/B spatially
and via the new search.

## Known gaps

- **No UI binds to any of this yet.** Reach (phase 8) is the first
  consumer of `computeCoverageGrid` via the Worker client; phase 9
  (Globe)/phase 11 (Explore) are the first consumers of
  `generateIllustrationRays`; phase 13 (Path) is the first consumer of
  `solveHopsForDistance`.
- **No Station/Conditions UI.** SFI, Kp, ground type, noise environment,
  power, gain, and any mode selector are plain parameters until phases
  6–7; `CoverageGridInput` has no `mode` field, so grid reliability uses
  SSB as an implicit reference (see [Behaviour](#coverage-grid) above).
- **The groundwave range formula is uncalibrated** — a judgment call
  providing the right qualitative direction (frequency- and ground-type-
  dependent), not a calibrated model. TX power is not a factor in it.
- **The coverage-grid sweep is not fully allocation-free.** It avoids
  reallocating per-iteration arrays and writes straight into typed-array
  output buffers, but still allocates a `Hop`/`LinkBudgetResult` object
  per hop, reusing phase 3's `computeLinkBudget` as the correctness
  source of truth rather than inlining the formulas. Flagged as a
  follow-up if the ~150ms NFR budget isn't met with real UI load in
  phase 8 — the coarse pass measured well under budget in this phase's
  own benchmark test, but that's a synthetic single-call measurement, not
  a real browser under UI load.
- **Illustration ray altitude profiles are a rendering aid, not a solved
  refraction path** — a half-sine curve from ground to virtual height and
  back per hop; no such formula exists in physics-and-fidelity.md, and
  none was needed since the physics claim (reflecting layer, MUF,
  reliability) is verified once and reused unchanged.
- **No real antenna patterns** — same symmetric-reference-receiver / plain
  dBi assumption as phase 3, until phase 6's pattern-family lookup.

## Related

- [Engine hub](README.md)
- [Geometry, layers, and MUF](geometry-and-layers.md) (phase 2)
- [Link budget and reliability](link-budget-and-reliability.md) (phase 3)
- [Feature #4](https://github.com/pskillen/rf-propagation/issues/4), task issues [#32](https://github.com/pskillen/rf-propagation/issues/32)–[#36](https://github.com/pskillen/rf-propagation/issues/36)
