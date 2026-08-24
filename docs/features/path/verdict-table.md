# Band × mode verdict table

## Purpose

Path's own answer to "which band and mode should I actually try, right
now, for this target?" — a ranked, best-first table across the trimmed
amateur-HF band catalogue and the three modes the reliability model
covers (SSB, CW, FT8). Independent of Compare's own, differently-scoped
table (see [Related](#related)).

## Code anchors

- `src/core/domain/propagation/verdictTable.ts` — `buildVerdictTable`,
  `VerdictRow`, `VERDICT_TABLE_MODES`. Core, no React/DOM: calls
  `solveHopsForDistance` once per band, then `modeVerdict` once per
  mode on the resulting hop solution.
- `src/app/routes/path/VerdictTable.tsx` — renders `VerdictRow[]` as
  mobile-first cards (not an HTML `<table>`), with an `ExplainThisLink`
  per row and optional row selection wired to
  [geometry-summary.md](geometry-summary.md).

## Inputs

`buildVerdictTable(bands, groundRangeKm, layers, context)`:

| Input           | Source                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------ |
| `bands`         | the trimmed `UK_AMATEUR_BANDS` catalogue (unchanged from phase 7)                          |
| `groundRangeKm` | `pathMetricsBetween(station.qth, target).distanceKm`                                       |
| `layers`        | `computeLayerStates(conditions, …)` — the same layer-state call Reach/Explore already make |
| `context`       | `SolveHopsContext` — antenna, power, noise environment from `ViewerState.station`          |

## Behaviour

- One row per band; each row's `bestReliability` is the maximum
  reliability across SSB/CW/FT8 for that band, and rows are sorted
  descending by that figure — best-first, not band-order.
- A band with no valid hop solution for the target range (`solveHopsForDistance`
  returns no usable solution) renders as `unreachable`, sorted after
  every reachable row, rather than being silently omitted — an
  operator should be able to see "this band can't do this distance
  today" as a real answer, not a gap in the table.
- Each row carries per-mode `ModeVerdict`s (reliability + `bucket` +
  `marginDb`), so the card can show all three modes' figures, not just
  the best one.

## Manual verify

1. Set a target ~2000 km from the station QTH under default (moderate)
   conditions: several bands should show reachable rows with a
   plausible best-first order; at least one long-haul band should show
   a non-trivial FT8 margin over SSB.
2. Set a target at an implausible distance for a given band (e.g. very
   short range on 80 m in a high-noise scenario, or very long range on
   a band that's not supporting multi-hop under current conditions):
   confirm an `unreachable` row renders and sorts last, not silently
   dropped.
3. Resize to 360px width: each card's SSB/CW/FT8 figures should remain
   readable without horizontal scrolling.

## Known gaps

- Only SSB/CW/FT8 are covered — this matches the reliability model's
  own scope (`modeVerdict`), not a Path-specific limitation.

## Related

- [../compare/side-by-side-and-delta.md](../compare/side-by-side-and-delta.md) —
  Compare's own, independently-built target-set table renders a
  per-mode dB _delta_ between two scenarios; it is not a port of, and
  does not share code with, this table.
