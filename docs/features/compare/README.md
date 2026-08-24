# Compare

**Compare** makes the product's core loop — change one thing, see the
difference — explicit and shareable, rather than something an operator
does by mentally holding two numbers in their head. The product doc
set's own worked example C (not linked here — see
[AGENTS.md](../../../AGENTS.md) on why `tmp/mvp-plan/` paths aren't
committed links): *same Station, same Conditions, two antennas compared
— a dipole at 7 m versus the same dipole at 12 m. Reach shows the second
reaching visibly further with a wider skip zone; the verdict table on
the FN31 target moves SSB from −4 dB to +1 dB.*

Compare varies **exactly one** of antenna, band or time between two
otherwise-identical scenarios — enforced by the state shape
(`ViewerState.compare`), not by convention. Both sides always share
`station.qth`, `station.powerW`, `station.noiseEnvironment`,
`conditions.driver`/`ground`, and `target` — there is deliberately no
`againstTargetId`/`againstQth` field.

This phase adds **no new engine code**: every number on this page comes
from calling `computeCoverageGrid` / `solveHopsForDistance` /
`computeLinkBudget` / `modeVerdict` — the exact same public entry points
Reach (phase 8) and Explore (phase 11) already call — once per side.

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Compare shell, two-configuration side by side | Shipped | A "Compare by" selector (antenna/band/time), an against-side picker, and two `CompareColumn`s — [side-by-side-and-delta.md](side-by-side-and-delta.md) |
| No-target comparison | Shipped | Each side computes its own `CoverageGridResult` via the same Worker client Reach uses, rendered via Reach's own `ReachMap`, plus a plain-km groundwave/first-hop delta | |
| Target-set comparison | Shipped | Each side's `HopSolution` via `solveHopsForDistance`, then SSB/CW/FT8 `ModeVerdict`s and a per-mode dB delta table — a lightweight, independently-built table, not a port of Path's eventual verdict table (which doesn't exist yet) | |
| Shareable via permalink | Shipped | `ViewerState.compare` is registered with the URL codec (`fields/compare.ts`) — a compare permalink reproduces both sides exactly | |
| Path's own verdict table | Not started | Phase 13 (Path, F10.2) — Compare's target-set table is independently built, not shared with Path's eventual component |

## Documentation map

| Doc | Covers |
| --- | --- |
| [side-by-side-and-delta.md](side-by-side-and-delta.md) | `compareScenario.ts`'s state derivation and delta math, the "compare by" UI, and both the no-target and target-set rendering paths |

## Concepts

- **Exactly one field varies** — `ViewerState.compare: { enabled,
  againstAntennaId?, againstBandId?, againstAtMs? }`. `deriveCompareSides`
  (`src/core/domain/propagation/compareScenario.ts`) falls back to the
  "current" side's own value for any unset `against*` field, so an
  all-unset `compare` is a valid, identical, zero-delta comparison.
- **The difference is called out, never left for the operator to
  subtract** — the target-set case renders `deltaDb` explicitly per mode
  (`right.marginDb - left.marginDb`); the no-target case renders a plain
  km delta on the groundwave/first-hop reach-extremes figures, since
  those genuinely aren't dB quantities.
- **No Path UI, no target picker** — Compare reads whatever `target` is
  already set (or `null`) from shared `ViewerState`; it does not add a
  way to set one.

## Cross-links

- Tracking: [Feature #11 "Compare"](https://github.com/pskillen/rf-propagation/issues/11)
- Task issues (phase 12): [#69](https://github.com/pskillen/rf-propagation/issues/69), [#75](https://github.com/pskillen/rf-propagation/issues/75)
