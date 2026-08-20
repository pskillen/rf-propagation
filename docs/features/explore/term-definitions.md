# Term definitions

## Purpose

In-place, touch-accessible jargon definitions (F8.4) — not a glossary
page, not a tutorial step.

## Code anchors

- `src/app/content/termDefinitions.ts` — `TERM_DEFINITIONS`, a plain
  `Record<TermKey, { label, definition }>` dictionary. App-layer UI copy,
  not domain logic.
- `src/app/components/TermDefinition/TermDefinition.tsx` — the reusable
  component: `<TermDefinition term="muf">MUF</TermDefinition>`.

## Behaviour

- Tap/click (not hover-only — a direct F8.4 acceptance criterion, since
  this is a mobile-first product) opens a popover; tap elsewhere or press
  Escape closes it.
- Reusable across surfaces — the component takes no Explore-specific
  dependency. Path's verdict table (phase 13, F10.2) is expected to
  import it directly for its own dB-margin/reliability column headers.
- `TermDefinition.test.tsx` exhaustively checks every `TermKey` has a
  non-empty entry — cheap insurance against a typo'd key silently
  rendering nothing.

## Wired into

- The vertical cross-section's caption (`takeoffAngle`) and a clickable
  D/E/F1/F2 layer legend below it.
- The ray overlay's colour-by hint (`snrMargin`, shown when `colourBy`
  is `'signalStrength'`).
- The link-budget breakdown panel's column headers (`takeoffAngle`,
  `snrMargin`, `muf`, `reliability`) — see
  [explain-this-and-breakdown.md](explain-this-and-breakdown.md).

## Known gaps

- Wording is a first draft (flagged in `termDefinitions.ts`'s own doc
  comment) — pending a pass against `physics-and-fidelity.md` and
  `feature-description.md §2`'s fixed vocabulary. The mechanism (the
  touch-accessible popover) is the load-bearing part of this slice, not
  the copy.

## Related

- Tracking issue: [#66](https://github.com/pskillen/rf-propagation/issues/66).
