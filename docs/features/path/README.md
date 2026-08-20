# Path

**Path** answers the operator's other core question — "will *this*
specific station hear me, and on what band/mode?" — once a target is
picked, as opposed to Reach's "who can I reach in general?" question
over the whole ground. Selecting a target is the single trigger: Path
isn't a separate navigation click, it's what the same "answer surface"
slot renders once `ViewerState.target` is non-null.

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Target picker (coordinates / locator / address / map) | Shipped | `TargetPicker.tsx` — three input modes plus a draggable map pin, a resolved-target readout with bearing/distance/octant, and a "Clear target" affordance — [target-picker.md](target-picker.md) |
| Band × mode verdict table | Shipped | `buildVerdictTable` (core) ranks SSB/CW/FT8 across the trimmed band catalogue best-first by reliability, rendered as mobile-first cards with `ExplainThisLink` — [verdict-table.md](verdict-table.md) |
| Geometry summary + antenna angle check | Shipped | Hop count/layer/takeoff angle for the verdict table's selected row, plus `computeAngleShortfall` flagging a ≥6 dB gap between the antenna's gain at the required elevation and its peak gain — [geometry-summary.md](geometry-summary.md) |
| Reach ↔ Path switching | Shipped | `activeAnswerSurface(state)` discriminates on `target !== null`; a Reach coverage-cell click now opens the full Path view (completing phase 8's stub); rays repack rose→fan on the target bearing; a crossfade transition, not a hard cut — [reach-path-switching.md](reach-path-switching.md) |
| Timeline (scrubbing target reach over time) | Not started | Phase 14 |

## Documentation map

| Doc | Covers |
| --- | --- |
| [target-picker.md](target-picker.md) | `resolveTarget`, the three input modes, the map/draggable-pin path, and the resolved-target readout |
| [verdict-table.md](verdict-table.md) | `buildVerdictTable`'s ranking, `VerdictTable.tsx`'s card layout, and how it differs from Compare's independent table |
| [geometry-summary.md](geometry-summary.md) | `computeAngleShortfall`'s antenna-pattern-vs-required-elevation check |
| [reach-path-switching.md](reach-path-switching.md) | `activeAnswerSurface`, the F5.5 target-shape reconciliation, and the rose→fan ray transition |

## Concepts

- **`target` is the discriminator, not a mode switch** — `ViewerState.target: Target | null` decides whether the answer-surface slot renders Reach or Path; there is no separate `surface: 'reach' | 'path'` field an operator sets directly. Setting `target` to `null` (via Path's own "Clear target" control) is what returns to Reach.
- **One target shape everywhere** — `{ lat, lon, label?, source }`, `source` one of `'map-click' | 'coordinates' | 'locator' | 'address' | 'map' | 'globe'`. Reach's coverage-cell click, Path's own picker, and any future Explore/Compare consumer all read and write this same shape.
- **Path builds its own verdict table** — `buildVerdictTable` (core) is independent of Compare's lightweight per-mode delta table (phase 12); they solve different problems (best-first ranking of one scenario vs. a two-side delta) and are not layered on top of each other.
- **Antenna angle shortfall** — a real, if approximate, diagnosis: comparing the antenna's modelled gain at the geometrically-required elevation angle against its own peak gain, not against some fixed "good" threshold. A ≥6 dB gap is flagged as a likely reason a band shows "poor" or "unreachable" despite adequate power/noise numbers.

## Known gaps

- Path's own canvas draws illustration rays via the same `generateIllustrationRays('fan', …)` call Explore uses, but does not (yet) render Reach's ground-shaded coverage grid underneath the great-circle line — the visual is rays + a summary panel, not a hybrid map.
- The antenna angle-shortfall check inherits the antenna-pattern module's known gain-shape gap for non-dipole families that ignore `heightM` (see [station/antenna-model.md](../station/antenna-model.md)) — the shortfall figure is only as good as the underlying pattern.
- Target draggability ships on Reach's/Path's 2D Leaflet map; the 3D globe view does not yet support dragging a target marker (setting one via the globe still works through the existing globe-click handler).

## Cross-links

- Tracking: [Feature #12 "Path"](https://github.com/pskillen/rf-propagation/issues/12) (parent epic [#2](https://github.com/pskillen/rf-propagation/issues/2))
- Task issues (phase 13): [#76](https://github.com/pskillen/rf-propagation/issues/76), [#70](https://github.com/pskillen/rf-propagation/issues/70), [#71](https://github.com/pskillen/rf-propagation/issues/71), [#72](https://github.com/pskillen/rf-propagation/issues/72)
