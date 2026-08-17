# Propagation engine

The propagation engine answers, for a given takeoff angle, frequency, and
space-weather/solar-geometry state: **which ionospheric layer reflects this
signal, or does it escape to space — what's the maximum usable frequency
(MUF) — and, given a known hop sequence, will they hear me?** (EIRP,
losses, SNR, per-mode margins, and a reliability percentage.) Every other
surface in the product (Reach, Explore, Compare, Path/Timeline) is built on
top of these answers.

The prior in-Studio engine (mk1) modelled the ionosphere incorrectly enough
that it shipped defects a validation harness would have caught before
release — flat-Earth hop geometry that overestimated single-hop range by
~3.5x, identical layer densities across D/E/F1/F2 (making the D layer, an
absorber only, mk1's daytime reflector), and an unbounded MUF secant factor
that overestimated by 3–6x exactly where it matters, at low takeoff angles.
This rebuild's engine and its validation harness exist specifically to fix
and then guard against those defects.

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Spherical hop geometry | Shipped | Incidence angle, half-hop central angle, ground range, closed-form inverse, slant path length — [geometry-and-layers.md](geometry-and-layers.md) |
| Per-layer ionospheric model (D/E/F1/F2) | Shipped | Each layer has its own critical frequency and virtual height — [geometry-and-layers.md](geometry-and-layers.md) |
| Reflection selection + MUF | Shipped | E → F1 → F2 candidate order, D structurally excluded — [geometry-and-layers.md](geometry-and-layers.md) |
| Physics validation harness (V1–V9, V19) | Shipped | Gates CI from phase 2 onward — [geometry-and-layers.md](geometry-and-layers.md) |
| Link budget (losses, noise, mode thresholds, reliability) | Shipped | EIRP, FSPL, D-layer absorption, ground/polarisation loss, noise floor, per-mode margins, reliability — [link-budget-and-reliability.md](link-budget-and-reliability.md) |
| Calibration anchors A/B, V10–V18, V20–V23 | Shipped | Full V1–V23 harness gates CI — [link-budget-and-reliability.md](link-budget-and-reliability.md) |
| Multi-hop path solving, coverage grid, illustration rays, Worker | Shipped | Coverage grid and illustration rays are separate code paths at separate resolutions — [multihop-coverage-and-rays.md](multihop-coverage-and-rays.md) |
| UI surfaces (Reach, Explore, Compare, Path/Timeline) | Not started | Later phases; Conditions (time, SFI/Kp source) doesn't exist as a UI surface until phase 7 |

## Documentation map

| Doc | Covers |
| --- | --- |
| [geometry-and-layers.md](geometry-and-layers.md) | Geometry primitives, layer model, reflection/MUF selection, and the validation harness (phase 2) |
| [link-budget-and-reliability.md](link-budget-and-reliability.md) | Losses, noise floor, mode thresholds, reliability, and `computeLinkBudget` (phase 3) |
| [multihop-coverage-and-rays.md](multihop-coverage-and-rays.md) | Multi-hop path solving, the coverage grid, illustration rays, and the coverage-grid Worker (phase 4) |

## Concepts

- **Takeoff angle (Δ)** — elevation angle above the horizon at which a signal leaves the antenna.
- **Virtual height (h′)** — the effective reflection altitude the engine uses for a layer (not the layer's true physical altitude, which varies with electron density profile).
- **Incidence angle (φ)** — the angle from vertical at which a wave strikes a layer; bounded by Earth's curvature, which is what caps the MUF factor.
- **Critical frequency (fo)** — the highest frequency a layer reflects at vertical incidence; each layer (E, F1, F2) has its own, computed from solar flux index (SFI), solar zenith angle (χ), and (for F2) geomagnetic index (Kp).
- **MUF (maximum usable frequency)** — `fo × sec(φ)` for a given layer and geometry; the highest frequency that layer reflects at that takeoff angle.
- **Solar zenith angle (χ)** — angle between the sun and the local zenith at a point; 0° = sun overhead, ≥90° = night. Gates F1's daytime-only activation and drives all three active layers' densities.
- **D-layer absorption** — the D layer never reflects (it only absorbs); this is enforced structurally in the reflection-selection code, not by a runtime condition. Its strength (`ionosphericAbsorptionDbPerHop`) is what actually drives the LUF (below).
- **LUF (lowest usable frequency)** — deliberately *not* computed as a standalone formula; it's emergent from the link budget (absorption driving SNR below a mode's threshold) — see [link-budget-and-reliability.md](link-budget-and-reliability.md).
- **Reliability** — never a boolean "reachable"; a 0–100% probability combining day-to-day MUF spread and SNR fading, bucketed Good/Marginal/Unlikely — see [link-budget-and-reliability.md](link-budget-and-reliability.md).
- **Skip zone** — the ring around a station where neither groundwave nor any hop lands; falls out of the coverage grid's data (a cell with no landing) rather than being computed as its own quantity — see [multihop-coverage-and-rays.md](multihop-coverage-and-rays.md).
- **Groundwave** — near-field coverage close to the station, independent of the ionosphere; an uncalibrated frequency/ground-type approximation at this fidelity tier (no formula is specified in the design doc) — see [multihop-coverage-and-rays.md](multihop-coverage-and-rays.md).
- **Coverage grid vs illustration rays** — the dense compute grid (fixed 72×90×4-hop resolution, feeds shading) and the illustration rays (an operator-sized, ≤16×≤10 rendering control) are separate code paths at separate resolutions, by design — changing one never changes the other's output. See [multihop-coverage-and-rays.md](multihop-coverage-and-rays.md).

## Cross-links

- Tracking: [Feature #4 "Propagation engine"](https://github.com/pskillen/rf-propagation/issues/4) (parent epic [#2](https://github.com/pskillen/rf-propagation/issues/2))
- Task issues (phase 2): [#22](https://github.com/pskillen/rf-propagation/issues/22), [#23](https://github.com/pskillen/rf-propagation/issues/23), [#24](https://github.com/pskillen/rf-propagation/issues/24), [#25](https://github.com/pskillen/rf-propagation/issues/25)
- Task issues (phase 3): [#26](https://github.com/pskillen/rf-propagation/issues/26)–[#31](https://github.com/pskillen/rf-propagation/issues/31)
- Task issues (phase 4): [#32](https://github.com/pskillen/rf-propagation/issues/32)–[#36](https://github.com/pskillen/rf-propagation/issues/36)
