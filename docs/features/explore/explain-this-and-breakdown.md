# Explain this, and the link budget breakdown

## Purpose

F8.5 — the reusable "explain this" entry point (a small link/button that
switches to Explore with an exact scenario loaded) and the breakdown
panel it lands on, which shows exactly where every dB in the link budget
went.

## Code anchors

- `src/app/state/explainThis.ts` — `navigateToExplore(navigate,
setViewerState, overrides?)`: sets `target`/`bandId` overrides (when
  given), flips `surface` to `'explore'`, navigates to `/explore`.
- `src/app/components/ExplainThis/ExplainThisLink.tsx` — the button
  component other surfaces are expected to import directly.
- `src/app/routes/explore/buildBreakdownRows.ts` —
  `buildLinkBudgetBreakdown(solution, context)`: turns a
  `solveHopsForDistance` `HopSolution` into a per-hop absorption table, a
  per-bounce ground-reflection table, and per-mode verdicts.
- `src/app/routes/explore/LinkBudgetBreakdown.tsx` — renders that data,
  with `TermDefinition` on every jargon term.

## Inputs

`ExplainThisLink` takes `target`/`bandId` as optional overrides — when
omitted, whatever is currently active in `ViewerState` is used unchanged.
There is no separate "Explore scenario" payload: `ViewerState` is the
single shared source of truth, so setting these two fields (when they
differ from what's active) plus flipping `surface` is enough for Explore
to render the right thing.

## Behaviour

- **No new hop-search implementation** — the breakdown panel calls the
  same `solveHopsForDistance` public entry point Path (phase 13) will use
  for its own verdict table.
- **Per-hop absorption and per-bounce ground reflection are direct F8.5
  acceptance criteria** — `LinkBudgetResult` only carries the pre-summed
  totals, so `buildLinkBudgetBreakdown` calls the same phase-3 functions
  `computeLinkBudget` calls internally (`ionosphericAbsorptionDbPerHop`
  once per hop, `groundReflectionLossDb(groundType, 1)` once per
  intermediate bounce), purely for display.
- **Reconciliation is enforced by an explicit test**
  (`buildBreakdownRows.test.ts`), run against phase 3's calibration
  Anchor A (3360km) and Anchor B (5000km) distances, fed through the real
  `solveHopsForDistance` path — not the anchors' own hand-picked hop
  count, which `multiHop.ts`'s own doc comment already flags as one hop
  short of what the honest search finds at those distances. The test
  asserts: summed per-hop absorption equals `LinkBudgetResult.absorptionDb`;
  summed per-bounce ground reflection equals `groundReflectionDb`;
  `eirpDbm − fsplDb − Σabsorption − Σground − polarisationDb +
rxAntennaGainDbi == receivedPowerDbm`; `receivedPowerDbm −
noiseFloorDbm == snrDb2400`.

## Deviations from the plan file's own sketch

- `navigateToExplore`'s real signature takes this repo's actual
  `ViewerStateContextValue.setState` shape (`ViewerState | ((prev)
=> ViewerState)`), not the plan's sketched `Partial<ViewerState>` patch
  setter — no "shallow-merge a partial patch" primitive exists anywhere
  else in this codebase.
- The breakdown's antenna gain uses the active antenna's flat nominal
  `gainDbi`, not an elevation/azimuth-aware figure —
  `solveHopsForDistance`'s own `SolveHopsContext` (phase 4) takes a flat
  number, unlike `CoverageGridInput`'s antenna-aware `txAntenna` object
  (Reach's own upgrade). Revisiting that shape for antenna-aware hop
  search is a later phase's call.

## Known gaps

- Reach's own coverage cells do not yet call `ExplainThisLink` — phase 8
  did not stub a hook waiting for this phase. Flagged as a phase-8 gap,
  not retroactively fixed here.
- `computeIllustrationRayBudget` (ray filtering's own colour-by) and this
  file's breakdown-row assembly are separate, unrelated code paths — Path
  (phase 13) builds its own verdict rows directly from
  `solveHopsForDistance`/`computeLinkBudget`/`modeVerdict`, not by reusing
  this file's row shape, since the two surfaces present the same numbers
  in genuinely different table shapes.

## Related

- Tracking issue: [#67](https://github.com/pskillen/rf-propagation/issues/67).
