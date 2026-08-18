# Gap: `heightM` shapes gain for one antenna family, is dead weight for the other three

Written 2026-08-18, mid-series (see [Series status](#series-status) below),
from a live-tested anomaly report against `dev`: editing the active
antenna's height from 1 m to 100 m on a **dipole**
(`bidirectional-transverse`) produced no visible change in Reach's coverage
pattern. Chasing that down surfaced a broader, adjacent fact worth recording
on its own: every `AntennaConfig` carries a required `heightM`
(`src/core/domain/station/types.ts:16`) and `AntennaList.tsx` always shows a
"Height above ground (m)" input for it (`AntennaList.tsx:415`, unconditional
— unlike the heading field at line 367, which is gated by
`HEADING_FAMILIES`) — but `antennaGain()`'s gain-shape math only reads
`heightM` in **one** of its four pattern-family cases. For the other three,
the operator can type any number into that field and the modelled pattern
is bit-for-bit identical.

**No code changes accompany this file.** It's a discussion document, in the
same spirit as `gaps/wire-antenna-configurations.md` — this one doesn't even
carry that file's small label/heading-field change, since the height field
already renders unconditionally for every family; there's nothing to add on
the UI side, only physics to (not) add.

**The live-tested dipole anomaly itself was investigated separately and
found to be a different, narrower issue than "height is unused"** —
`bidirectional-transverse` is the one family whose gain math *does* use
`heightM`, and the per-elevation gain shape genuinely does change
dramatically between 1 m and 100 m (confirmed numerically). What doesn't
change, visibly, is the *rendered coverage map* — see
[§ The dipole anomaly: a second, separate finding](#the-dipole-anomaly-a-second-separate-finding)
below for why, and the PR description that accompanies this file's commit
for the full numeric trace. That investigation doesn't belong in this file's
main thread because it isn't a "heightM is unused" gap at all — it's a
"heightM is used, but the effect is hard to see on the map" observation,
worth keeping distinct from this file's actual subject.

---

## Series status

16-phase plan, `tmp/mvp-plan/plans/00-README.md`. Phases 1–8 complete;
phase 8a (Reach directionality/antenna/greyline follow-up work) has landed
as a stack of PRs on top of phase 8:

| PR | Status | Branch |
| --- | --- | --- |
| [#93](https://github.com/pskillen/rf-propagation/pull/93) | phase 8, Reach coverage surface | `7/pskil/reach-coverage-surface` |
| [#95](https://github.com/pskillen/rf-propagation/pull/95) | phase 8a: directionality wired into the coverage grid, antennas editable in place, dipole heading, 2D greyline/terminator | stacked on #93 |
| [#96](https://github.com/pskillen/rf-propagation/pull/96) | phase 8a follow-up: recompute-cadence fixes | stacked on #95 |
| [#97](https://github.com/pskillen/rf-propagation/pull/97) | phase 8a follow-up: antenna edit form always visible inline, dirty-state indicator | stacked on #96 |
| [#98](https://github.com/pskillen/rf-propagation/pull/98) | phase 8a follow-up: long-wire heading input, `gaps/wire-antenna-configurations.md` | stacked on #97 |
| [#99](https://github.com/pskillen/rf-propagation/pull/99) | fix: re-anchor greyline terminator to the map's world copy on pan | stacked on #98 |
| this file's change | open, stacked on #99 | `fix/antenna-height-gap-and-dipole` |

This file's gap is independent of all of the above — it's about
`antennaGain()`'s own formula bodies (`src/core/domain/antenna/
antennaPattern.ts`), not the coverage-grid call sites, recompute cadence, or
the greyline layer.

---

## What's modelled today, cited against the actual code

`antennaPattern.ts`'s `antennaGain()` switch has exactly four cases, keyed
on `AntennaConfig.family`:

- **`omnidirectional-vertical`** (`antennaPattern.ts:50-53`) —
  `sin(θ)·cos(π/2·sin θ)`. Function of elevation only. **`heightM` not
  read.**
- **`bidirectional-transverse`** (dipole, `antennaPattern.ts:54-59`) —
  `|cos(φ−φ0)| · |groundReflectionFactor(θ, heightM, λ)|`, where
  `groundReflectionFactor` (`antennaPattern.ts:29-32`) is
  `2·sin((2π·heightM/λ)·sin θ)`. **The only case that reads `heightM`.**
- **`directional-lobe`** (beam, `antennaPattern.ts:60-67`) —
  `cos(...)^8 · sin(θ)^3`, function of elevation and azimuth only.
  **`heightM` not read.**
- **`multi-lobe-conical`** (long wire, `antennaPattern.ts:68-86`) — function
  of `θ`, `wireLengthWavelengths`, and frequency (via `λ`) only. **`heightM`
  not read** — already flagged once, from a different angle, in
  `gaps/wire-antenna-configurations.md`'s citation of this same case
  (`antennaPattern.ts`'s own inline comment there notes `heightM` is
  "accepted on every `AntennaConfig` but this case never reads it").

Three of four families accept a height value the UI collects and the
persistence layer stores, and silently ignore it when computing the gain
shape that actually drives Reach's coverage grid
(`src/core/domain/propagation/coverageGrid.ts`'s
`elevationGainDbi(input.txAntenna, elevationDeg, azimuthDeg,
input.frequencyMhz)` call, once per swept cell).

## Why this is a real physical gap, not just an unused field

Height above ground genuinely shapes the elevation pattern for all three
missing families, by different physical mechanisms:

- **`omnidirectional-vertical`** — a ground-mounted vertical's takeoff-angle
  pattern depends on ground conductivity, radial/counterpoise system, and
  height of any elevated feed or matching network above the actual ground
  plane. A vertical on a good radial system a few centimetres off the dirt
  behaves differently from the same element with an elevated counterpoise a
  few metres up — genuinely different low-angle radiation, the exact
  property that determines DX performance for this family. `heightM` exists
  on every `AntennaConfig` and would be the natural field to carry this, but
  today it's collected and discarded for verticals.
- **`directional-lobe`** (beam) — a Yagi/beam's takeoff angle is strongly a
  function of mast/stacking height above ground, for the same ground-image
  interference reason a dipole's height matters (a beam is still a
  horizontally-polarised antenna over ground, even though its azimuth
  pattern is directional rather than omnidirectional). A 10 m beam and a
  30 m beam on the same band have measurably different peak-radiation
  elevation angles — this is one of the most commonly cited practical
  reasons hams stack or raise beams, and it's entirely unmodelled here;
  `directional-lobe`'s formula has no ground-interference term at all, only
  the synthetic azimuth/elevation beamwidth shape.
- **`multi-lobe-conical`** (long wire) — already covered by
  `gaps/wire-antenna-configurations.md`'s citation of the same case; a
  level long wire's height above ground affects its elevation lobing the
  same way a dipole's does (both are horizontal-wire geometries), but the
  formula here is a pure function of wire length in wavelengths and never
  applies a ground-reflection term the way `bidirectional-transverse` does.

**What this file does not do**, per `gaps/wire-antenna-configurations.md`'s
own stated stance on the adjacent long-wire-azimuth gap: it does not invent
or propose a specific height-vs-ground-interference formula for any of the
three missing families. `groundReflectionFactor` — the one such formula
that already exists in this codebase — is specific to a level horizontal
dipole's image-antenna geometry; reusing it verbatim for a vertical
(different polarisation, different ground-coupling physics) or a beam
(would need to compose with the existing directional beamwidth terms, not
replace them) is a real antenna-theory decision, not a mechanical port. That
decision belongs in a future planning conversation.

## The dipole anomaly: a second, separate finding

The live-tested report that triggered this file — editing a
`bidirectional-transverse` antenna's height from 1 m to 100 m with no
visible change on the Reach coverage map — is **not** an instance of the
gap described above. `bidirectional-transverse` is the one family whose
`antennaGain()` case does read `heightM`, via `groundReflectionFactor`, and
that formula's output genuinely differs enormously between 1 m and 100 m at
typical HF wavelengths: sampled directly (`antennaGain`/`elevationGainDbi`
called at 7/14/21 MHz, θ = 0–89°), 1 m height gives a near-monotonic,
single-lobe rise toward zenith, while 100 m height gives several lobes and
nulls across the same elevation range, with per-degree gain differences up
to ~20 dB at some elevations. Confirmed live in the browser too — the
in-form pattern-preview plot (`AntennaPatternPreview`) visibly redraws from
a smooth single-lobe arc to a multi-lobe scalloped one as height is edited
from 1 m to 100 m, and `localStorage`'s persisted `Station` correctly picks
up `heightM: 100` on the active antenna after Save.

So the per-elevation antenna gain really is different — but Reach's
rendered coverage map still looks nearly identical before and after the
edit, for two compounding reasons specific to how `coverageGrid.ts` turns
per-elevation gain into a per-cell colour:

1. **Best-of-all-takeoff-angles cell selection.** `computeCoverageGridAtStride`
   sweeps all 90 elevation angles per azimuth and, for whichever ground
   cell each one lands in, keeps only the *best* reliability seen
   (`coverageGrid.ts`: `if (verdict.reliability > reliabilityArr[cellIdx])`).
   A cell's rendered colour is an envelope over every elevation that
   happens to reach it, not a reading at one fixed takeoff angle — so a
   deep gain null at one specific elevation is invisible if some other
   elevation that also lands nearby still has a comfortable link margin.
2. **Reliability saturates.** `reliability.ts`'s `pSnr(marginDb) =
   Phi(marginDb/8)` approaches 1 quickly once the SNR margin is
   comfortably positive — so a several-dB or even tens-of-dB antenna-gain
   swing between two cases can still map to a reliability difference too
   small to read as a different fill opacity
   (`cellFillStyle.ts`'s `opacity = 0.15 + 0.65·reliability`), and the
   fill *hue* only changes when the winning hop-count category itself
   flips, which happens for a small minority of cells.

This was checked quantitatively, not just asserted: diffing
`computeCoverageGrid` output for otherwise-identical 1 m vs. 100 m dipole
inputs shows real per-cell differences (`hopCount` differs on a small
percentage of cells depending on frequency; `snrDb` differs by tens of dB
on some cells) that are real but small/scattered enough not to read as an
obviously different map at a glance. Full numbers are in this file's
accompanying PR description rather than repeated here, to keep this file
about the *height-unused* gap rather than duplicating that trace.

**This is not treated as a bug fix candidate in this file** — per the
investigation, it's a legitimate consequence of a deliberate cell-selection
and reliability-modelling design (envelope-over-elevations, saturating SNR
margin), not a wiring defect. Whether the coverage map *should* expose
per-elevation antenna-pattern detail more directly (e.g. a takeoff-angle
diagnostic separate from the cell-envelope view) is a UX question for a
future conversation, not a mechanical fix implied by this finding.

## Options, not a recommendation

As with the other gap files, no fix is chosen here:

1. **Add a ground-interference/height term to `omnidirectional-vertical`
   and `directional-lobe`** (and, per `gaps/wire-antenna-configurations.md`,
   `multi-lobe-conical` too) — the largest option, needing real
   antenna-theory derivation for each family's specific ground-coupling
   geometry (vertical: counterpoise/radial system and ground conductivity;
   beam: composing a height-dependent term with the existing synthetic
   beamwidth shape) rather than a shared formula.
2. **Do nothing further, keep the label honest instead** — e.g. a UI hint
   on the height field for the three unaffected families, similar to the
   inline hint `gaps/wire-antenna-configurations.md`'s change already added
   for the long-wire heading field ("recorded, but not yet modelled"),
   so the operator isn't misled into thinking a height edit will visibly
   change those three families' coverage.
3. **For the dipole case specifically**: consider a future takeoff-angle
   diagnostic view (distinct from the coverage-grid envelope) if operators
   want to see the per-elevation gain-shape difference directly — this is
   closer to `gaps/antenna-editing.md`'s already-proposed polar-plot work
   (items 3–4 there) than to anything in this file's own scope.

Whichever direction, none of this blocks any later phase — `antennaGain`'s
switch is additive per family, same as `gaps/wire-antenna-configurations.md`
already noted for the long-wire case.
