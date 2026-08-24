# Target picker

## Purpose

How an operator sets `ViewerState.target` from Path: three text-entry
modes plus a draggable map pin, and how the resolved target is shown
back to them.

## Code anchors

- `src/app/routes/path/resolveTarget.ts` — pure resolution from one of
  three input modes to a `Target | null`; no React, no DOM.
- `src/app/routes/path/TargetPicker.tsx` — the mode switch, the three
  input forms, the map, and the resolved-target readout.
- `src/app/lib/geo/bearingDistance.ts` — `compassOctant`,
  `formatDistanceKmAndMi`, `formatBearing` (extended this phase).
- `src/core/domain/maidenhead.ts` — `isValidLocator` / `locatorToCoords`
  (pre-existing; reused, not reimplemented).

## Inputs

| Mode          | Fields                                  | Resolution                                                                                                  |
| ------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `coordinates` | manual lat/lon numbers                  | valid only if both are finite and within range (±90 / ±180)                                                 |
| `locator`     | a Maidenhead locator string             | valid only if `isValidLocator` accepts it; centre-of-square coordinates from `locatorToCoords`              |
| `address`     | a free-text search via Photon geocoding | valid only once a geocoded result is picked from the combobox; label carried through to the resolved target |

Dragging the map pin (or clicking the map) sets `target` directly from
the click/drag coordinates, independent of whichever text mode is
selected — the picker does not force the operator to reconcile a
dragged pin with stale text-input values.

## Behaviour

- The resolved-target readout (shown once `target` is non-null) renders
  bearing, distance (km and mi), and a compass octant computed from
  `pathMetricsBetween(station.qth, target)` — the same geometry helper
  the verdict table and geometry summary use, so all three panels agree
  with each other by construction rather than by convention.
- "Clear target" sets `target` back to `null`, which is what returns the
  answer-surface slot to Reach (see
  [reach-path-switching.md](reach-path-switching.md)) — there is no
  separate "switch to Reach" button.
- Switching input mode does not clear an already-resolved target; it
  only changes which input form is shown.

## Browser storage

None directly — `target` lives in in-memory `ViewerState` and, once set,
in the URL state codec's `target` field for permalink sharing. No
locator/address/coordinate history is persisted.

## Manual verify

1. Open Path with no target set: only the mode switch and input forms
   render, no resolved-target readout.
2. Type a valid Maidenhead locator (e.g. `IO91`) in locator mode: the
   readout appears with a plausible bearing/distance from the current
   station QTH.
3. Switch to address mode, search a town name, pick a result: the
   readout updates and carries the picked label.
4. Drag the map pin: the readout updates to the dropped coordinates,
   `source: 'map'`.
5. Click "Clear target": the readout disappears and the answer surface
   reverts to Reach.

## Known gaps

- Address search depends on Photon's public geocoding endpoint being
  reachable; there is no offline/cached fallback.
- Globe-based target dragging is not implemented (see the Path feature
  hub's Known gaps).

## Related

- [../path/README.md](README.md)
- [../reach/target-selection.md](../reach/target-selection.md) — Reach's
  own coverage-cell-click target-setting, which this phase reconciles
  its shape against.
