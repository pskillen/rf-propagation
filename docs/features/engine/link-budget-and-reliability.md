# Link budget, noise, modes, and reliability

## Purpose

Covers the modules that turn phase 2's "which layer reflects this, and at
what MUF" answer into a number an operator can act on: a link budget in dB,
an SNR, per-mode margins, and a reliability percentage. Product-level
framing is in the [engine hub](README.md).

## Code anchors

| Module                                           | Exports                                                                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/domain/propagation/losses.ts`          | `freeSpaceSpreadingLossDb`, `ssnFromSfi`, `ionosphericAbsorptionDbPerHop`, `GroundType`, `POLARISATION_LOSS_DB`, `groundReflectionLossDb` |
| `src/core/domain/propagation/noise.ts`           | `NoiseEnvironment`, `noiseFloorDbm`                                                                                                       |
| `src/core/domain/propagation/modes.ts`           | `Mode`, `MODE_THRESHOLD_DB_2400HZ`, `modeMarginDb`                                                                                        |
| `src/core/domain/propagation/reliability.ts`     | `standardNormalCdf`, `pMuf`, `pSnr`, `reliability`, `ReliabilityBucket`, `reliabilityBucket`, `ModeVerdict`, `modeVerdict`                |
| `src/core/domain/propagation/linkBudget.ts`      | `Hop`, `LinkBudgetInput`, `LinkBudgetResult`, `computeLinkBudget`                                                                         |
| `src/core/domain/propagation/validation.test.ts` | Validation harness V10-V18, V20-V23, and calibration anchors A/B (extends phase 2's V1-V9/V19)                                            |

All modules are pure functions — no React, no DOM, no Worker — enforced by
the `src/core/**` ESLint layer-boundary rule.

## Inputs

`computeLinkBudget` takes a **known** hop sequence (takeoff angle,
reflecting layer, ground range, slant path, solar zenith, and that hop's
MUF — see `Hop` below) plus frequency, TX power, antenna gains, ground
type, noise environment, SSN, and receiver bandwidth. It does **not**
search for the best hop count (phase 4) and does **not** select which
layer reflects (phase 2's `reflection.ts`) — both are given inputs here.

## Behaviour

**Free-space spreading loss** (`losses.ts`): `32.44 + 20·log10(d) +
20·log10(f)` over the true summed slant path (not ground range).

**D-layer absorption** (`losses.ts`): non-deviative absorption-index form,
summed per hop, using each hop's own incidence angle at 90km (`D`'s
absorbing height) and solar zenith at that hop's midpoint. The bracket term
clamps to exactly zero once solar zenith reaches 90° (no D layer at
night). The formula's one fitted constant, `K`, is calibrated (not
derived) — see [Calibration](#calibration-constant-k) below.

**Ground reflection and polarisation** (`losses.ts`): 2dB (sea) / 4dB
(land) / 3dB (mixed, a flat average pending real terrain data) per
**intermediate** hop-to-hop bounce, plus a fixed 3dB polarisation loss
applied once per path (not per hop). The model assumes a reference receive
station with the same antenna gain as TX (physics-and-fidelity.md §4.3) —
antenna gain itself is a plain `number` until phase 6's pattern-family
lookup exists.

**Noise floor** (`noise.ts`): ITU-R P.372 man-made noise (by environment:
urban/residential/rural/quiet-rural), taken as the greater of man-made and
galactic noise. Bandwidth is always an explicit parameter — never assumed
— since skipping it would make SNR comparisons meaningless. Atmospheric
(thunderstorm) noise is **not modelled**; this reads optimistically on the
low bands (160m/80m), a documented fidelity gap, not a bug.

**Mode thresholds** (`modes.ts`): required SNR per mode, normalised to a
2.4kHz reference bandwidth (SSB +6dB, CW −7dB, FT8 −21dB, WSPR −29dB), so
`snrDb2400` (computed at that bandwidth) serves every mode.

**Reliability** (`reliability.ts`): never a boolean "reachable" — combines
day-to-day MUF spread (~15%) and SNR fading (σ ≈ 8dB) via the standard
normal CDF (`Φ`, implemented as an Abramowitz & Stegun 7.1.26 rational
approximation — JS has no built-in erf/CDF) into a 0–100% reliability,
bucketed **Good** (≥70%), **Marginal** (30–70%), **Unlikely** (<30%).
`modeVerdict` assembles a mode's margin, reliability, and bucket in one
call.

**Link budget assembly** (`linkBudget.ts`): `computeLinkBudget` sums the
above across a known hop sequence into EIRP, FSPL, absorption, ground/
polarisation loss, received power, noise floor, SNR, and the weakest-link
hop's MUF (for reliability's `P_muf` term).

### Calibration constant K

`ionosphericAbsorptionDbPerHop`'s one fitted parameter starts at the
literature-cited 677.2 (physics-and-fidelity.md §4.2 — the literature
disagrees on its value). It was **verified against V10-V13, not left
unchecked**: a sweep from K=60 to K=900 showed the four checks only hold
simultaneously for K roughly in **[595, 735]** — below that, Anchor B's CW
verdict comes out "Good" instead of the required "Marginal"; above it,
"Unlikely" instead of "Marginal". 677.2 sits centrally in that window with
comfortable margin on every bucket boundary, so it was kept unchanged.

## Validation harness

`validation.test.ts` extends phase 2's V1-V9/V19 with:

| #              | Assertion                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| V10            | 80m, 3000km, local noon, SFI 120 → Unlikely for all modes (daytime absorption)                                                          |
| V11            | 80m, 3000km, both ends in darkness → Good for CW/FT8 at least                                                                           |
| V12 (Anchor A) | 20m, 3360km, single F2 hop, daytime → Good for SSB/CW/FT8                                                                               |
| V13 (Anchor B) | 20m, 5000km, two F2 hops, daytime → FT8 Good, CW Marginal, SSB Unlikely                                                                 |
| V14            | 10m, 3000km, SFI 70, night → escapes / Unlikely (above MUF)                                                                             |
| V15            | 10m, 3000km, SFI 220, day → Good (solar max opens 10m)                                                                                  |
| V16            | 40m, 200km, NVIS, midday → Good (single-point reliability only — the spatial "no skip zone" claim is a phase-4/8 coverage-grid concern) |
| V17            | 20m, 200km, vertical antenna → Unlikely (skip zone)                                                                                     |
| V18            | Round-the-world at 28MHz requires ≥5 hops (a geometry fact, computed directly — see deviation note below)                               |
| V20            | Raising TX power never lowers SNR                                                                                                       |
| V21            | Raising frequency never increases absorption                                                                                            |
| V22            | Adding a hop never increases received power                                                                                             |
| V23            | Moving from urban to quiet-rural noise never lowers reliability                                                                         |

**Deviations from the phase plan** (documented in `validation.test.ts`'s
header, mirroring phase 2's V2/V4 note):

- **Anchor A/B absorption-dB figures.** The plan's worked tables give
  Anchor A's absorption as "≈15dB" and Anchor B's as "≈34.8dB". Computed
  from the plan's own formula at the plan's own stated takeoff angles, the
  ratio between these two is fixed by geometry alone (~1.65×) —
  independent of `K` — but the plan's two figures imply a ~2.32× ratio. No
  single `K` satisfies both simultaneously. What actually pins `K` (per
  the plan's own text) is the per-mode bucket split, which passes with
  comfortable margin; the intermediate dB figures are treated as
  approximate.
- **V18's worked micro-example.** The plan's own "confirm 5 equal hops fit
  and 4 don't" doesn't hold under the model's own hop-distance cap: the
  true minimum equal-hop count for round-the-world at F2's height is 11
  (10 hops still exceeds F2's ~3836km single-hop cap). The actual
  acceptance criterion — "requires at least 5 hops" — still holds, since
  11 ≥ 5.
- **`Hop.mufMhz`.** The plan's literal `Hop` interface has no field a
  critical frequency could come from, yet `LinkBudgetResult.mufMhz` is
  specified as "the weakest-link hop's MUF". A `mufMhz: number` field was
  added to `Hop` — strictly additive, no existing field changed — since
  callers already have this value for free from `selectReflectingLayer`'s
  `ReflectionResult` when constructing a hop (per the plan's own V10-V18
  instructions). Phase 4 imports `Hop` directly, so this is called out
  explicitly for the breakpoint-3 review.

## Manual verify

```bash
npm run test -- losses noise modes reliability linkBudget validation
```

All suites should pass; `validation.test.ts` (V1-V23) gates CI on every PR
touching the engine from this phase onward.

## Known gaps

- **No multi-hop path solving, coverage grid, or Worker** — `computeLinkBudget`
  takes a known hop sequence; searching hop counts 1-5 for the best budget
  is phase 4 (F2.11).
- **No real antenna patterns** — gain is a plain `number` (dBi) parameter
  until phase 6's pattern-family lookup (F4.3).
- **No Station/Conditions UI** — SFI, Kp, ground type, noise environment,
  power and gain are plain parameters until phases 6-7.
- **Atmospheric noise is not modelled** — see [Behaviour](#behaviour)
  above; needs to surface in the UI in phase 16 (F13.3), not be silently
  fixed here.
- **Kp/geomagnetic-storm modelling is crude** — inherited from phase 2's
  `layers.ts`, unchanged here.

## Related

- [Engine hub](README.md)
- [Geometry, layers, and MUF](geometry-and-layers.md) (phase 2)
- [Feature #4](https://github.com/pskillen/rf-propagation/issues/4), task issues [#26](https://github.com/pskillen/rf-propagation/issues/26)–[#31](https://github.com/pskillen/rf-propagation/issues/31)
