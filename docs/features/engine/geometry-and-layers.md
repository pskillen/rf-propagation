# Geometry, layers, and MUF

## Purpose

Covers the three pure-function modules that make up the engine as of this
phase: spherical single-hop geometry, the per-layer ionospheric model, and
reflection/MUF selection — plus the validation harness that gates every
later engine change. Product-level framing (why this matters, status across
phases) is in the [engine hub](README.md).

## Code anchors

| Module                                            | Exports                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/core/domain/propagation/geometry.ts`         | `EARTH_RADIUS_KM`, `incidenceAngleRad`, `halfHopCentralAngleRad`, `groundRangePerHopKm`, `takeoffAngleForGroundRangeRad`, `slantPathLengthKm`                                                                                                                |
| `src/core/domain/propagation/layers.ts`           | `LayerId`, `LayerState`, `layerStates`                                                                                                                                                                                                                       |
| `src/core/domain/propagation/reflection.ts`       | `ReflectionResult`, `mufFactor`, `selectReflectingLayer`                                                                                                                                                                                                     |
| `src/core/domain/propagation/solarZenithAngle.ts` | `SolarGeometry`, `solarGeometryAt`, `solarZenithAngleDeg` — ported as-is from Codeplug Studio (ham-radio-adjacent astronomy utility, not propagation-specific); this phase placed it inside `propagation/` since it currently has one consumer (`layers.ts`) |
| `src/core/domain/propagation/validation.test.ts`  | Validation harness V1–V9, V19 (test-only, no exports)                                                                                                                                                                                                        |

All modules are pure functions — no React, no DOM, no Worker — enforced by
the `src/core/**` ESLint layer-boundary rule.

## Inputs

All angles are **radians** in function signatures (degrees only at doc/test
boundaries, converted explicitly); all distances are **km**; all
frequencies are **MHz**.

| Input                           | Where it's used                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Takeoff angle Δ                 | Geometry, MUF factor                                                                                                                |
| Virtual height h′               | Geometry (per layer: D=90km, E=110km, F1=200km, F2=300km day / 350km night)                                                         |
| Solar flux index (SFI)          | Layer critical frequencies                                                                                                          |
| Geomagnetic index (Kp)          | F2 critical-frequency depression                                                                                                    |
| Solar zenith angle (χ, degrees) | Layer critical frequencies, F1/F2 day-night switching — computed by the caller via `solarZenithAngleDeg`, not by `layers.ts` itself |
| Geomagnetic latitude (degrees)  | Kp depression factor (auroral-zone weighting)                                                                                       |
| Operating frequency             | Reflection/MUF selection                                                                                                            |

## Behaviour

**Geometry** (`geometry.ts`): `sin(φ) = Re·cos(Δ)/(Re+h′)` gives the
incidence angle; `θ = arccos(Re·cos(Δ)/(Re+h′)) − Δ` gives the half-hop
central angle (one up-leg's worth; a full hop's ground range is `2·Re·θ`).
`slantPathLengthKm` returns **one half-hop only** — callers summing a full
hop's free-space path loss (a phase-3 concern) must add two of these
themselves. The Earth's curvature bounds `φ`, which is what caps the MUF
secant factor (~3.4x for F2 at 300km, ~5.4x for E at 110km) instead of
mk1's unbounded flat-Earth factor.

**Layers** (`layers.ts`): each of E, F1, F2 gets its own critical-frequency
formula (SFI- and χ-dependent); D always reports `criticalFrequencyMhz:
null` and has no formula at all — it's an absorber, not a candidate. F1
switches off entirely (`null`) once χ ≥ 75°. F2's day formula
(`foF2_noon·cos(χ)^0.25`) is floored at its night value
(`0.45·foF2_noon`) once χ ≥ 89°, so the day curve blends into the night
floor rather than dipping below it just before the cutover; F2's virtual
height also switches from 300km (day) to 350km (night) at the same
threshold. Kp depresses F2 via `1 − 0.03·Kp·clamp01((|geomagLat|−45)/45)`
— zero effect below 45° geomagnetic latitude, strongest toward the poles.
This Kp term is explicitly the least-trustworthy part of the model (a real
storm's effect is far more structured than a uniform multiplier) — flagged
in code comments, not silently modelled as better than it is.

**Reflection/MUF** (`reflection.ts`): `selectReflectingLayer` walks E, then
F1, then F2 (ascending virtual height — a wave meets the lowest layer
first) and returns the first one whose MUF (`fo × sec(φ)`) is at or above
the requested frequency, or `{ kind: 'escaped' }` if none qualifies. **D is
never in the candidate lookup at all** — not skipped by a condition, but
structurally absent — which is the single most important line of code in
this phase (see V6 below). LUF is not computed here; it's emergent from
the phase-3 link budget.

## Validation harness

`validation.test.ts` runs as part of `npm run test` (and therefore CI) from
this phase onward. Each check is independently identifiable by its
V-number:

| #   | Assertion                                                                                         |
| --- | ------------------------------------------------------------------------------------------------- |
| V1  | F2 MUF factor never exceeds 3.6 at any Δ ≥ 0°                                                     |
| V2  | E-layer MUF factor is tightly bounded (≤5.5 — see note below)                                     |
| V3  | A single F2 hop never exceeds 4000km ground range                                                 |
| V4  | A single E hop is tightly bounded (≤2400km — see note below)                                      |
| V5  | Δ → θ → Δ round-trips to within 0.05° across [1°, 89°]                                            |
| V6  | The D layer is never returned as a reflecting layer (the mk1 regression check)                    |
| V7  | E/F1/F2 have mutually distinct critical frequencies for any daytime SFI; D is always null         |
| V8  | At χ=0°, SFI=120: foE≈3.9MHz, foF2≈8.0MHz, foE<foF1<foF2                                          |
| V9  | At night, F1 and D are inactive; F2 is the sole long-haul reflector                               |
| V19 | Raising SFI never lowers MUF (layer critical frequencies and end-to-end MUF are monotonic in SFI) |

**V2/V4 numeric note:** the phase 2 plan states E's MUF-factor cap as 5.4
and single-hop range cap as 2100km; its own prose elsewhere separately
estimates the MUF-factor cap as "~5.2". Computed directly from this
phase's own geometry formulas at h′=110km, the true supremum as Δ→0
(grazing incidence) is sec(φ)≈5.4508 and ground range≈2350.95km — both
above the plan's literal figures, and outside its own "~5.2" estimate too.
These are internally-inconsistent approximate figures in the plan
document, not a verified target; V2/V4 assert against the true geometric
supremum with a small margin (5.5 / 2400km) instead, preserving the
check's actual purpose (E is tightly bounded, nowhere near mk1's unbounded
~19x blowup) without being fragile to which rounded figure the plan text
used. See the phase 2 PR description for this call.

## Manual verify

No UI surface exists yet (Conditions arrives in phase 7). To exercise the
engine directly:

```bash
npm run test -- geometry layers reflection validation
```

All four suites (and `solarZenithAngle`) should pass; `validation.test.ts`
specifically is what gates CI on every PR touching the engine from this
phase onward.

## Known gaps

- **No losses, SNR, reliability, or mode verdicts** — a reflecting layer +
  MUF (or escape) is an _input_ to a link budget, not a link budget
  itself. Phase 3.
- **No multi-hop path solving, coverage grid, or Worker** — these
  functions operate on one hop at a time. Phase 4.
- **Kp/geomagnetic-storm modelling is crude** — a uniform multiplier by
  geomagnetic latitude, not the patchy, time-lagged, latitude-banded
  structure of a real storm. Flagged in `layers.ts` and unlikely to
  improve materially in this product's scope.
- **Sporadic-E, TEP, and other anomalous propagation modes are not
  modelled** — only the standard D/E/F1/F2 layer set.
- **Calibration anchors A/B and V10–V18/V20–V23 are not yet checked** —
  they require the full link budget (phase 3) to validate against.

## Related

- [Engine hub](README.md)
- [Feature #4](https://github.com/pskillen/rf-propagation/issues/4), task issues [#22](https://github.com/pskillen/rf-propagation/issues/22)–[#25](https://github.com/pskillen/rf-propagation/issues/25)
