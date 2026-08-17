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
- `src/app/components/station/AntennaList.tsx` — antenna switcher +
  add-antenna form.
- `src/app/components/station/AntennaPatternPreview.tsx` — SVG
  elevation-gain plot.

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
})` — one click. The add-antenna form (`FormField`/`TextInput`/
`Combobox`) collects name, pattern family, height, azimuth (shown only
for `directional-lobe`), and gain; on submit it appends to
`Station.antennas` via `mergeStation`.

## `AntennaPatternPreview`

A plain SVG line plot of `elevationGainDbi(antenna, θ, azimuthDeg,
frequencyMhz)` for θ from 0° to 90°, at a **hardcoded reference
frequency (14 MHz)** — Conditions (phase 7) doesn't exist yet to supply
an "active band," so there's no real frequency to plot against yet.
Once phase 7 lands, this should switch to the active band's frequency.

## Manual verify

```sh
npm run dev
```

- Click "Edit station" → the antenna pattern preview renders a curve
  for the default 40m dipole.
- Add a second antenna with a different pattern family and height —
  switch between them with one click; the preview curve visibly
  changes shape.
- Add a `directional-lobe` antenna — confirm the heading (azimuth)
  field appears only for that family.

## Known gaps

- Antenna heading ships as a numeric `azimuthDeg` field only — a
  draggable compass-needle control is phase 10's job (F7.3 owns the
  full direct-manipulation standing constraint).
- No antenna deletion UI — out of this phase's stated scope.
- The pattern preview's hardcoded 14 MHz reference frequency should be
  replaced once phase 7's Conditions supplies a real active band.

## Related

- [README.md](README.md) — feature hub, implementation status
- [station-model.md](station-model.md)
