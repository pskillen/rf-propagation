# Side by side and the dB/km delta

## Code anchors

- `src/core/domain/propagation/compareScenario.ts` — `CompareState`,
  `DEFAULT_COMPARE_STATE`, `CompareSide`, `deriveCompareSides`,
  `CompareDelta`, `computeCompareDeltas`.
- `src/app/components/compare/compareCoverageSummary.ts` —
  `computeCoverageReachDelta` (the no-target case's plain-km delta).
- `src/app/routes/compare/ComparePage.tsx` — orchestration: derives both
  sides, runs the engine twice, renders either the two coverage columns
  or the verdict table.
- `src/app/components/compare/CompareAgainstPicker.tsx` — the "compare
  by" selector and the against-side's single-field picker.
- `src/app/components/compare/CompareColumn.tsx` — one side's map +
  reach-extremes summary (no-target case).
- `src/app/components/compare/CompareVerdictTable.tsx` — the per-mode dB
  delta table (target-set case).
- `src/app/lib/urlState/fields/compare.ts` — the URL field codec.

## State model

`ViewerState.compare` (`CompareState`, defined in
`compareScenario.ts` rather than alongside `GlobeToggles`/
`RayControlsState` in `src/app/state/` — see that file's own doc comment
for why: it's tightly coupled to `deriveCompareSides`'s derivation logic,
and `core` never imports from `app`, so the type lives wherever the
derivation function that consumes it lives):

```ts
interface CompareState {
  enabled: boolean;
  againstAntennaId?: string;
  againstBandId?: string;
  againstAtMs?: number;
}
```

There is deliberately no `againstTargetId`/`againstQth` — both sides
always share `station.qth`, `station.powerW`, `station.noiseEnvironment`,
`conditions.driver`/`ground`, and `target`. Exactly one of the three
`against*` fields is set in the common case (the "Compare by" selector
steers toward this), but `deriveCompareSides` doesn't enforce it — more
than one set simply means both sides differ in more than one respect.

`deriveCompareSides` takes a narrow, structurally-typed slice of
`ViewerState` rather than importing `ViewerState` itself (`core` never
imports from `app`) — `ComparePage.tsx` calls it with the real
`ViewerState`, which satisfies the slice structurally. This is a
deliberate deviation from the phase plan's literal
`deriveCompareSides(state: ViewerState)` snippet, not a change to its
behaviour: the "current" side is always `state`'s own values; the
"against" side substitutes whichever `against*` field is set, falling
back to the current side's own value for anything unset.

## Enabling Compare — one interaction

A `ToggleSwitch` in Compare's own controls panel sets `compare.enabled`.
Turning it on for the common two-antenna case defaults
`againstAntennaId` to the _other_ antenna, so "duplicate the current
configuration and change one thing" takes the single click that turns
Compare on — no second step to pick what varies. With more than two
antennas (or only one), it starts as an identical, zero-delta comparison
the operator then edits via the "compare by" selector.

## Rendering: two cases

**No target set** (`ViewerState.target === null`) — each side computes
its own `CoverageGridResult` via the same `useReachCoverage` hook Reach
(phase 8) uses, called twice with the "against" side's antenna/band/time
substituted into an otherwise-identical `Station`/`Conditions`/
frequency. Each side renders via Reach's own `ReachMap` component,
read-only here (drag and click are no-ops — Compare never moves
`station.qth` or sets a target itself). Below both columns,
`computeCoverageReachDelta` reports the groundwave-max and first-hop-min
range delta in km — plain numbers, not forced into a dB figure, since
neither is naturally one.

**Target set** — each side computes a `HopSolution` via
`solveHopsForDistance` for the shared target's great-circle distance
(the same calling pattern Explore's own link-budget breakdown already
establishes — see
[explain-this-and-breakdown.md](../explore/explain-this-and-breakdown.md)),
then `computeLinkBudget` + `modeVerdict` for SSB/CW/FT8. `deltaDb`
(`right.marginDb - left.marginDb`) is rendered explicitly next to each
mode's two margins in `CompareVerdictTable`, with a sign and a colour
cue for which side improved — "the difference is called out in dB, not
left for the operator to subtract" (F9.2). This table is a lightweight,
independently-built two-column table, **not** a port of Path's eventual
verdict table (`VerdictTable.tsx`, F10.2, phase 13 — doesn't exist yet).

## Shareable via permalink

`compare` is registered with the URL codec exactly like every other
`ViewerState` sub-object (`fields/compare.ts`, appended to
`FIELD_CODECS` in `codec.ts`, and added to `viewerStateToUrlState`'s
mapping) — the Share button's permalink already serialises the full
`ViewerState`, so once `compare` round-trips through the codec, a
comparison is shareable for free. See
[url-state-codec.md](../app-shell/url-state-codec.md)'s "Fields so far"
table.

## Tests

- `compareScenario.test.ts` — `deriveCompareSides`'s fallback and
  single-field-substitution behaviour; `computeCompareDeltas`'s delta
  sign/magnitude against a worked-example-C-shaped fixture.
- `compareCoverageSummary.test.ts` — `computeCoverageReachDelta`'s
  groundwave/first-hop km delta, including the "no coverage in a
  category" and "identical sides" edge cases.
- `ComparePage.test.tsx` — the disabled state, the no-target two-column
  render, and the target-set verdict table render (mocking the coverage
  Worker the same way `ReachPage.test.tsx` does).

## Related

- [README.md](README.md) — feature hub, implementation status
- [../reach/coverage-surface.md](../reach/coverage-surface.md) — the
  `CoverageGridResult`/`ReachMap` machinery this phase reuses unchanged
- [../explore/explain-this-and-breakdown.md](../explore/explain-this-and-breakdown.md) —
  the `solveHopsForDistance` calling pattern this phase's target-set case
  follows
