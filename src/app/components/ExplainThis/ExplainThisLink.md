# ExplainThisLink

The F8.5 "explain this" entry point (phase 11's Slice 5) — a small button
meant to sit next to any verdict or coverage cell on any surface. Clicking
it switches `ViewerState.surface` to `'explore'`, optionally overrides
`target`/`bandId` with the calling cell's own values, and navigates to
`/explore`.

## Props

| Prop        | Type                    | Notes                                                         |
| ----------- | ----------------------- | ------------------------------------------------------------- |
| `target`    | `ViewerState['target']` | Optional override — omit to keep whatever target is active.   |
| `bandId`    | `string`                | Optional override — omit to keep whatever band is active.     |
| `label`     | `string`                | Default `"Explain this"`.                                     |
| `className` | `string`                | Extra class(es) for layout inside a caller's own cell markup. |

## Behaviour

No separate "Explore scenario" payload — `ViewerState` is the single
shared source of truth (`ux-and-ia.md §6`). Setting `target`/`bandId`
(when they differ from what's currently active) plus flipping `surface`
is sufficient: Explore reads `station`/`conditions`/`bandId`/`target`
exactly like every other surface, so arriving via this link already shows
the right thing.

## Reusable across surfaces

This is the mechanism other surfaces call into — Path's verdict table
(phase 13, F10.2's "each cell opens into F8.5's explanation") is expected
to import this component directly rather than re-implementing
navigation-to-Explore. See `src/app/state/explainThis.ts`'s
`navigateToExplore` for the underlying helper, if a caller needs the
navigation logic without this component's button chrome.

## Known gaps

- Reach's own coverage cells do not yet call this component — check
  whether phase 8 stubbed an "explain this" hook waiting for this phase;
  if it didn't, that's a phase-8 gap to flag, not retroactively fixed
  here (this phase only builds the entry point itself).
