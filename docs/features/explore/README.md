# Explore

**Explore** is the founding persona's whole product: a new licensee who
has been told about skip, NVIS and the greyline and would quite like to
*see* one. It is a destination in its own right (a top-level surface,
same as Reach/Path/Timeline), and also the landing spot for "explain
this" — a small reusable affordance any verdict or coverage cell on any
surface can drop in, which switches to Explore with that exact scenario
already loaded.

Explore reads the *same* shared `ViewerState` (station, conditions,
bandId, target) every other surface reads — there is no separate
"Explore scenario" object to populate, so arriving via either door shows
the right thing immediately.

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Vertical cross-section | Shipped | Labelled 2D side-on slice along the current bearing — D/E/F1/F2 background bands (drawn only when active), the station, every generated ray, the primary hop polyline, and a target marker in Path mode — [cross-section-and-rays.md](cross-section-and-rays.md) |
| Illustration ray overlay | Shipped | Operator-sized radial/elevation/spread controls, a manual bearing when no target is set, rendered on both the cross-section and the 3D globe from one `generateIllustrationRays` call — [cross-section-and-rays.md](cross-section-and-rays.md) |
| Ray filtering, colour-by, layer soloing | Shipped | Outcome filter, colour by outcome/reflecting layer/signal strength, and a layer-solo picker — all pure transforms over the already-generated ray array, never a second engine call — [cross-section-and-rays.md](cross-section-and-rays.md#filtering-colour-and-soloing) |
| In-place term definitions | Shipped | `TermDefinition`, a small reusable touch-accessible popover component, wired into Explore's own labels — [term-definitions.md](term-definitions.md) |
| Explain this / link budget breakdown | Shipped | `ExplainThisLink`/`navigateToExplore` (the reusable entry point) plus a per-hop, per-loss-type breakdown panel that reconciles exactly to the engine's own totals — [explain-this-and-breakdown.md](explain-this-and-breakdown.md) |
| Path/Compare UI | Not started | Phase 12 (Compare) and phase 13 (Path) are later phases; Path is the first real consumer of `ExplainThisLink` for its verdict-table cells |
| Reach's own "explain this" wiring | Not started | Reach's coverage cells do not yet call `ExplainThisLink` — phase 8 did not stub a hook waiting for this; flagged as a phase-8 gap, not this phase's job to retroactively add |

## Documentation map

| Doc | Covers |
| --- | --- |
| [cross-section-and-rays.md](cross-section-and-rays.md) | The vertical cross-section diagram, the ray overlay controls, the single-`generateIllustrationRays`-call invariant, and filter/colour/solo |
| [term-definitions.md](term-definitions.md) | `TermDefinition` and `TERM_DEFINITIONS` |
| [explain-this-and-breakdown.md](explain-this-and-breakdown.md) | `ExplainThisLink`/`navigateToExplore` and the link-budget breakdown panel's reconciliation guarantee |

## Concepts

- **Illustration rays vs the coverage grid** — see the engine's own
  [multihop-coverage-and-rays.md](../engine/multihop-coverage-and-rays.md#illustration-rays).
  Explore is the first surface where an operator actually touches ray
  controls with their hands; the "illustration is not compute" invariant
  is enforced here by construction and by an explicit test — see
  [cross-section-and-rays.md](cross-section-and-rays.md).
- **`ViewerState.display.rayControls`** — Explore's own ray-count/filter/
  colour/solo state, a sibling of phase 9's `globeToggles` on
  `ViewerState.display`, registered with the URL codec so a permalink
  reproduces the exact ray-view state.
- **"Explain this" is reusable, not Explore-only** — the entry point
  (`ExplainThisLink`, `navigateToExplore`) and `TermDefinition` take no
  Explore-specific dependency; Path (phase 13) is the first later
  consumer.

## Cross-links

- Tracking: [Feature #10 "Explore"](https://github.com/pskillen/rf-propagation/issues/10)
- Task issues (phase 11): [#64](https://github.com/pskillen/rf-propagation/issues/64), [#65](https://github.com/pskillen/rf-propagation/issues/65), [#66](https://github.com/pskillen/rf-propagation/issues/66), [#67](https://github.com/pskillen/rf-propagation/issues/67), [#68](https://github.com/pskillen/rf-propagation/issues/68)
