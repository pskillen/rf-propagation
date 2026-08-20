# TermDefinition

In-place jargon definitions (F8.4, phase 11's Slice 4). Renders its
children inline with a touch-accessible affordance — tap/click opens a
popover with the term's plain-language definition; tap elsewhere or
press Escape closes it. Not a link to a glossary page, not a tutorial
step.

## Props

| Prop       | Type        | Notes                                                               |
| ---------- | ----------- | ------------------------------------------------------------------- |
| `term`     | `TermKey`   | Key into `TERM_DEFINITIONS` (`src/app/content/termDefinitions.ts`). |
| `children` | `ReactNode` | The inline text/label the popover is anchored to.                   |

## Behaviour

- **Touch-accessible, not hover-only** — a direct F8.4 acceptance
  criterion, since this is a mobile-first product. The trigger is a plain
  `<button>` toggled on click/tap, not a `:hover` CSS rule.
- **Closes on outside pointerdown or Escape** — a `pointerdown` listener
  (covers touch and mouse) checks whether the event target is outside the
  component's root, and a `keydown` listener watches for Escape. Both are
  only attached while the popover is open.
- **Reusable across surfaces** (F8.4's own acceptance criterion) — this
  component takes no Explore-specific dependency. Path's verdict table
  (phase 13, F10.2) is expected to import it directly for its own
  dB-margin/reliability column headers.

## Content

`src/app/content/termDefinitions.ts` — a plain `Record<TermKey,
{ label, definition }>` dictionary. UI copy, not domain logic (lives in
the `app` layer, not `core`, per the layer-boundary rule). Every
`TermKey` used anywhere in the app must have a non-empty entry —
`TermDefinition.test.tsx` asserts this exhaustively as cheap insurance
against a typo'd key silently rendering nothing.

## Known gaps

- Wording is a first draft (this phase's own plan file: "adjust for
  tone/accuracy against physics-and-fidelity.md and
  feature-description.md §2's fixed vocabulary" as a follow-up, not a
  blocker for this phase).
