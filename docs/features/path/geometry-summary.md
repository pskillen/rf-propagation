# Geometry summary and antenna angle check

## Purpose

For the verdict table's currently-selected band, show the actual hop
geometry (hop count, reflecting layer, takeoff angle) and diagnose
whether the antenna itself is a likely limiting factor at that angle —
turning "this band shows poor" into "this band shows poor, and here's
roughly why."

## Code anchors

- `src/app/routes/path/geometrySummary.ts` — `computeAngleShortfall`,
  `ANGLE_SHORTFALL_THRESHOLD_DB`. Pure function; takes a
  `gainAtElevation` lookup rather than the antenna model directly, so
  it's testable against synthetic patterns without the real antenna
  module.
- `src/app/routes/path/GeometrySummary.tsx` — renders the selected
  row's `HopSolveResult` geometry plus the shortfall diagnosis, with a
  "Compare with different antenna" link into Compare.

## Inputs

| Input                  | Source                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `requiredElevationDeg` | the selected `VerdictRow`'s hop solution's takeoff angle                                                       |
| `gainAtElevationDbi`   | `elevationGainDbi` bound to the active antenna's real pattern (the same call Reach's directional shading uses) |

## Behaviour

- `computeAngleShortfall` compares `gainAtElevationDbi(requiredElevationDeg)`
  against the antenna's own peak gain (`max` over the pattern, not a
  fixed reference figure). A gap ≥ `ANGLE_SHORTFALL_THRESHOLD_DB` (6 dB)
  is flagged.
- The geometry summary always renders hop count/layer/takeoff angle
  regardless of the shortfall result — the angle-shortfall check is an
  additional diagnosis, not a replacement for showing the raw geometry.
- "Compare with different antenna" links into Compare pre-seeded to
  vary antenna, so an operator flagged with a shortfall has an
  immediate next action rather than just a diagnosis.

## Manual verify

1. Select a verdict-table row with a low takeoff angle and a
   low-mounted antenna: the shortfall diagnosis should flag a gap.
2. Select a row where the required elevation sits near the antenna's
   peak-gain lobe: no shortfall should be flagged.
3. Follow "Compare with different antenna": Compare should open with
   antenna as the varying field.

## Known gaps

- Inherits the antenna-pattern module's known gain-shape gap: non-dipole
  antenna families ignore `heightM`, so the shortfall figure for those
  families is only as reliable as that underlying pattern (see
  [station/README.md](../station/README.md)).

## Related

- [verdict-table.md](verdict-table.md) — the row this summary describes
- [../station/antenna-model.md](../station/antenna-model.md)
