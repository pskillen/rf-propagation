# Antenna model — pattern families and absolute dBi

## Purpose

Covers the four antenna pattern families, the gain-shape math ported
from mk1, and the absolute-dBi layer (`elevationGainDbi`) this phase
adds on top — the gap
[F4.3](https://github.com/pskillen/rf-propagation/issues/43) names as
"pattern families ported from mk1 and given absolute dBi rather than
mk1's relative-only gain." Not covered here: the `AntennaConfig` shape
itself (see [station-model.md](station-model.md)).

## Code anchors

- `src/core/domain/antenna/antennaPattern.ts` — `wavelengthM`,
  `groundReflectionFactor`, `antennaGain`, `peakGainElevationDeg`
  (ported verbatim), `elevationGainDbi` (new).
- `src/app/components/station/AntennaList.tsx` — antenna switcher, a
  shared add/edit form (edit-in-place shipped in
  `fix/reach-directionality-antenna-greyline`, see below), and the
  in-progress-draft publisher `AntennaPatternPreview` reads from.
- `src/app/components/station/AntennaPatternPreview.tsx` — three
  polar-plot cuts (two elevation, one azimuth) of the active or
  in-progress-draft antenna's gain pattern.

**Filing choice, flagged:** this lives under a new `antenna/` domain
subfolder, not `station/` — the pattern-shape math is antenna physics,
independent of any particular Station. Neither design doc specifies
this split; it's this phase's own call.

## Pattern families

| Family                     | Shape                                                 | Notes                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `omnidirectional-vertical` | `sin(θ)·cos(π/2·sin θ)`                               | Azimuth-independent; overhead null at θ=90°                                                                                                                     |
| `bidirectional-transverse` | Figure-8 azimuth × ground-reflection elevation factor | A horizontal dipole. Height above ground (`heightM`) governs the NVIS-vs-DX elevation peak — see below                                                          |
| `directional-lobe`         | Cosine-power azimuth lobe × `sin(θ)³` elevation       | A beam/yagi-like pattern; peaks at its own `azimuthDeg` heading                                                                                                 |
| `multi-lobe-conical`       | Long-wire multi-lobe interference pattern             | Governed by `wireLengthWavelengths` (defaults to 2 if unset — no UI field for it in this phase's add-antenna form; the ported function's own default covers it) |

`antennaGain()` returns a **relative power ratio** in `[0, ~2]` — its
own doc comment (carried over from mk1) describes it as "a
multiplicative weight on transmit power," not dBi and not a
voltage/field ratio. This is the exact gap this phase closes.

## NVIS vs DX (height dependence)

For `bidirectional-transverse`, `groundReflectionFactor(θ, heightM,
λ)` governs where the elevation peak sits: a low horizontal dipole
(height ≪ λ) peaks straight up (NVIS, good for close-in HF); a dipole
at height ≈ λ/2 peaks at a lower elevation angle (better for DX).
`AntennaPatternPreview` makes this an observable UI behaviour, not
just a unit-test property — `antennaPattern.test.ts` asserts the peak
elevation angle differs between a 3m and a 15m dipole.

## `elevationGainDbi` — the absolute-dBi layer

```ts
export function elevationGainDbi(
  antenna: AntennaConfig,
  elevationDeg: number,
  azimuthDeg: number,
  frequencyMhz: number,
): number {
  const relative = antennaGain(antenna, elevationDeg, azimuthDeg, frequencyMhz);
  const peak = peakRelativeGain(antenna, frequencyMhz); // max of antennaGain() over θ=0..90 at the antenna's own peak azimuth
  return (
    antenna.gainDbi +
    10 * Math.log10(Math.max(relative, RELATIVE_GAIN_FLOOR) / Math.max(peak, RELATIVE_GAIN_FLOOR))
  );
}
```

**Judgment call, flagged:** neither mk1 nor `physics-and-fidelity.md`
specify a relative-to-absolute conversion formula, only that one must
exist. This normalises the relative pattern to unity at its own peak,
then scales so the peak equals the antenna's stated `gainDbi` — i.e.
`elevationGainDbi(antenna, peakGainElevationDeg(...), ...) ===
antenna.gainDbi` is the function's defining property, asserted directly
in `antennaPattern.test.ts`. Since `antennaGain()`'s return value is a
power ratio (not voltage/field), the conversion is `10·log10(ratio)`,
not `20·log10(ratio)`. A `RELATIVE_GAIN_FLOOR = 1e-6` avoids `-Infinity`
at pattern nulls — a deep null legitimately reads as a large negative
but finite dB, not `undefined` or `NaN`.

**Not called anywhere in this phase.** Phase 8 (Reach) is the first
caller, feeding a Station's active antenna into
`computeCoverageGrid`/`computeLinkBudget`. Its parameter order and
return units are treated as load-bearing for phase 13 (Path, F10.3)'s
"does the antenna actually radiate at that angle" diagnosis.

## `AntennaList`

Named antennas via `SegmentedControl` (not `Pill` for the switcher
itself — `Pill`'s `onClick` only activates when `tone="dashed"`, so a
row of selectable named-antenna pills silently wouldn't respond to
clicks; `Pill` with `tone="dashed"` is used only for the "+ Add
antenna" toggle affordance, which is exactly the ported kit's intended
use for that tone). Switching writes `mergeStation({ activeAntennaId
})` — one click.

**Edit in place** (`fix/reach-directionality-antenna-greyline`): an
"Edit" button alongside the switcher opens the same form pre-filled
with the currently-active antenna's fields; on submit it **replaces**
that antenna in `Station.antennas` (same `id`, same position) rather
than appending. "+ Add antenna" is still a separate, always-available
action — editing is additive, not a replacement for creation. Both
paths share one `buildAntennaFromForm` validator/constructor so the
heading-field gate (below) can't drift between them.

The form (`FormField`/`TextInput`/`Combobox`) collects name, pattern
family, height, heading (azimuth), and gain. **Heading field gate:**
shown for `directional-lobe` **and `bidirectional-transverse`** — a
dipole's figure-eight has a real azimuth term in `antennaGain`
(`Math.abs(Math.cos(...))`), the form just never exposed it before
this change. `multi-lobe-conical` and `omnidirectional-vertical` stay
ungated: the former's azimuth term is present in the type but unused
by its own formula (a known, out-of-scope gap — no design doc
specifies a multi-lobe azimuthal-lobing model, and mk1 never had one
either); the latter genuinely has no azimuth term at all.

## `AntennaPatternPreview`

Three polar-plot **cuts** of `elevationGainDbi`, all sharing one
`(min, max)` gain range for their radius scaling (see the component's
own doc comment for why a per-cut-independent scale would be wrong —
in short, it's what makes an omnidirectional antenna's azimuth cut
read as a genuine circle instead of collapsing to a point, and a
dipole's nulled broadside cut collapse toward the centre instead of
always filling the frame):

| Plot                         | Sweep                                                              | Fixed at                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Elevation, parallel cut      | θ 0°→90°, both sides of the antenna's boresight, meeting at zenith | `φ = azimuthDeg` and `azimuthDeg + 180`                                                                                                |
| Elevation, perpendicular cut | Same construction, 90° off the boresight                           | `φ = azimuthDeg + 90` and `azimuthDeg + 270`                                                                                           |
| Azimuth                      | φ 0°→360°                                                          | `θ = peakGainElevationDeg(antenna, azimuthDeg, freq)` — wherever the antenna is actually strongest, not an invented "DX takeoff angle" |

This is what makes a beam's forward lobe / back-lobe stub and a
dipole's figure-eight visible anywhere in the app for the first time —
Reach's coverage-map shading (see
[../reach/coverage-surface.md](../reach/coverage-surface.md#directionality))
is the other place the same `elevationGainDbi` shape now shows up. A
full 3D pattern viewer is the natural next step; explicitly out of
scope here — three 2D cuts are the intentionally smaller v1.

Still at a **hardcoded reference frequency (14 MHz)** — Conditions'
own active band isn't threaded in here; unchanged scope from when this
doc was first written, revisit once a surface needs it.

**Reflects the in-progress form draft, not just the active antenna**
(`fix/reach-directionality-antenna-greyline`): `AntennaList` derives a
best-effort `AntennaConfig`-shaped draft from its own form state
whenever the add/edit form is open (even before it's valid/
submittable) and publishes it via an `onDraftChange` callback;
`StationBar` holds that draft and passes `draftAntenna ?? activeAntenna`
into the preview. Previously the preview always showed
`activeAntenna`, which was wrong the moment a form was open.

## Manual verify

```sh
npm run dev
```

- Click "Edit station" → the antenna pattern preview renders three
  panels for the default 40m dipole.
- Add a second antenna with a different pattern family and height,
  watching the preview update live as you type, before submitting.
- Click "Edit" on the active antenna, change its height, and submit —
  confirm the antenna count doesn't grow (no duplicate created).
- Add or edit a `directional-lobe` **or `bidirectional-transverse`**
  antenna — confirm the heading (azimuth) field appears for both, and
  rotating the heading visibly moves the forward lobe on the parallel
  elevation cut and the azimuth cut.

## Known gaps

- Antenna heading ships as a numeric `azimuthDeg` field only — a
  draggable compass-needle control is phase 10's job (F7.3 owns the
  full direct-manipulation standing constraint).
- No antenna deletion UI — out of scope for this and the prior phase.
- The pattern preview's hardcoded 14 MHz reference frequency should be
  replaced once a surface needs the active band instead.
- `multi-lobe-conical`'s azimuthal-lobing formula is unmodelled — its
  `antennaGain` case takes `phiDeg` as a parameter but never
  references it, so a long-wire/rhombic's pattern preview and coverage
  shading are azimuth-invariant regardless of heading. This is a
  physics decision (what formula a long-wire's azimuth pattern should
  actually follow), not an engineering gap; mk1 never modelled it
  either.
- Editing only reaches the **currently-active** antenna (one "Edit"
  button, not a per-pill affordance) — switch the active antenna first
  to edit a different one. A per-pill edit control is a reasonable
  future refinement, not something this change needed.

## Related

- [README.md](README.md) — feature hub, implementation status
- [station-model.md](station-model.md)
