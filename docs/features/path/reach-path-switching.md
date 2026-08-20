# Reach ↔ Path switching

## Purpose

`target` is the primary navigation between Reach's "who can I reach in
general" question and Path's "will this specific station hear me"
question — not a settings-panel toggle a separate click sets: `target`
is the discriminator, not a side-effect of a navigation click.

## Code anchors

- `src/app/state/reachPathSwitch.ts` — `activeAnswerSurface(state)`,
  returning `'reach'` for `target === null` and `'path'` otherwise.
- `src/app/routes/AnswerSurfaceRoute.tsx` — the app-shell route
  rendered at `/`, switching between `ReachPage` and `PathPage` on that
  discriminator with a CSS crossfade (`AnswerSurfaceRoute.module.css`),
  not an instant hard cut.
- `src/app/components/reach/ReachMap.tsx` /
  `src/app/routes/reach/ReachPage.tsx` — the target marker is now
  draggable on Reach's own map, in the same `{lat, lon, label, source}`
  shape Path's picker uses.
- `src/app/routes/path/PathPage.tsx` — once a target is set, its own
  illustration-ray canvas calls `generateIllustrationRays` with
  `mode: 'fan'` and `focusBearingDeg` from
  `pathMetricsBetween(station.qth, target).bearingAB`, rather than
  `mode: 'rose'`.

## Behaviour

- **Selecting a target switches Reach → Path.** Any write to
  `ViewerState.target` from any surface (Reach's coverage-cell click,
  Path's own picker, a dragged map pin) is what flips
  `activeAnswerSurface`'s result — there is no independent "go to Path"
  navigation action.
- **Clearing the target returns to Reach.** Path's "Clear target"
  control (see [target-picker.md](target-picker.md)) sets `target` back
  to `null`; that alone reverts the answer surface, with no separate
  "switch to Reach" button anywhere in Path's chrome.
- **Timeline and Explore are unaffected.** `activeAnswerSurface` only
  governs the one "answer surface" route slot; explicitly-navigated
  surfaces (Explore, and Timeline once phase 14 ships) are reached via
  their own routes regardless of whether `target` is set.
- **Rays repack from a 360° rose to a focused fan** once a target
  exists — true both for Path's own new canvas and (already, as a
  regression check rather than new work) for Explore, since Explore's
  ray hook already reads the same shared `target`.
- **The transition is legible**: `AnswerSurfaceRoute` crossfades between
  the two renders rather than swapping instantly, so an operator can
  see the surface actually change rather than experiencing an
  unexplained content swap.

## Manual verify

1. With no target set, load `/`: Reach renders.
2. Click a Reach coverage cell: the view crossfades to the full Path
   view (target picker, verdict table, geometry summary) for that
   cell's coordinates — not a same-surface summary panel.
3. In Path, drag the map pin to a new location: the verdict table and
   geometry summary recompute for the new target; rays stay in fan
   mode focused on the new bearing.
4. Click "Clear target" in Path: the view crossfades back to Reach.
5. Navigate to Explore with a target set: its ray canvas should already
   be in fan mode focused on that target's bearing (no code change
   required here — confirms the regression check).

## Known gaps

- The crossfade is a CSS opacity/transform transition on the route
  wrapper; it is not a shared-element/morph animation between Reach's
  coverage shading and Path's great-circle line.

## Related

- [target-picker.md](target-picker.md) — the "Clear target" control and
  the shared target shape
- [../reach/target-selection.md](../reach/target-selection.md) — Reach's
  own coverage-cell-click target-setting (phase 8), now completed by
  this phase's Slice 4
