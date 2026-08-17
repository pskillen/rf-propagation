# Propagation engine

The propagation engine answers, for a given takeoff angle, frequency, and
space-weather/solar-geometry state: **which ionospheric layer reflects this
signal, or does it escape to space — and what's the maximum usable
frequency (MUF)?** Every other surface in the product (Reach, Explore,
Compare, Path/Timeline) is built on top of these answers plus a link budget
(losses/SNR — a later phase).

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
| Physics validation harness (V1–V9, V19) | Shipped | Gates CI from this phase onward — [geometry-and-layers.md](geometry-and-layers.md) |
| Link budget (losses, SNR, mode verdicts) | Not started | Phase 3 |
| Multi-hop path solving, coverage grid, Worker | Not started | Phase 4 |
| Calibration anchors A/B, V10–V18, V20–V23 | Not started | Phase 3/later — need the full link budget to validate against |
| UI surfaces (Reach, Explore, Compare, Path/Timeline) | Not started | Later phases; Conditions (time, SFI/Kp source) doesn't exist as a UI surface until phase 7 |

## Documentation map

| Doc | Covers |
| --- | --- |
| [geometry-and-layers.md](geometry-and-layers.md) | Geometry primitives, layer model, reflection/MUF selection, and the validation harness |

## Concepts

- **Takeoff angle (Δ)** — elevation angle above the horizon at which a signal leaves the antenna.
- **Virtual height (h′)** — the effective reflection altitude the engine uses for a layer (not the layer's true physical altitude, which varies with electron density profile).
- **Incidence angle (φ)** — the angle from vertical at which a wave strikes a layer; bounded by Earth's curvature, which is what caps the MUF factor.
- **Critical frequency (fo)** — the highest frequency a layer reflects at vertical incidence; each layer (E, F1, F2) has its own, computed from solar flux index (SFI), solar zenith angle (χ), and (for F2) geomagnetic index (Kp).
- **MUF (maximum usable frequency)** — `fo × sec(φ)` for a given layer and geometry; the highest frequency that layer reflects at that takeoff angle.
- **Solar zenith angle (χ)** — angle between the sun and the local zenith at a point; 0° = sun overhead, ≥90° = night. Gates F1's daytime-only activation and drives all three active layers' densities.
- **D-layer absorption** — the D layer never reflects (it only absorbs); this is enforced structurally in the reflection-selection code, not by a runtime condition.
- **LUF (lowest usable frequency)** — deliberately *not* computed by this engine layer; it's emergent from the phase-3 link budget (absorption driving SNR below the mode threshold), not a standalone formula.

## Cross-links

- Tracking: [Feature #4 "Propagation engine"](https://github.com/pskillen/rf-propagation/issues/4) (parent epic [#2](https://github.com/pskillen/rf-propagation/issues/2))
- Task issues: [#22](https://github.com/pskillen/rf-propagation/issues/22), [#23](https://github.com/pskillen/rf-propagation/issues/23), [#24](https://github.com/pskillen/rf-propagation/issues/24), [#25](https://github.com/pskillen/rf-propagation/issues/25)
