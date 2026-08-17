---
name: debounced-inputs
description: >-
  Debounced text and number inputs in Propagation Viewer — committed+commit
  hooks, debounce intervals, blur flush, pending UI, and when to use
  filter-only or async debounce instead. Use when adding sliders,
  NumberInputs that persist to storage/URL, or fixing focus loss on
  per-keystroke save.
---

# Debounced inputs

This app is largely **sliders and persisted numeric inputs** — power, height,
frequency, solar flux, time — so getting this pattern right early matters
more here than in most apps. The hooks below don't exist yet; port them
(with tests) from Codeplug Studio the first time a persisted input needs
this behaviour, rather than inventing a new pattern per component.

## Default pattern (persisted values)

Use a **committed + commit hook** when input changes must **persist**
(URL, `localStorage`, Station/Conditions state) or trigger expensive work
(re-running the engine) that must not run every keystroke.

| Input type | Hook | Path |
| --- | --- | --- |
| Text (name / callsign filter) | `useDebouncedNameFilter` | `src/app/hooks/useDebouncedNameFilter.ts` |
| Optional number (`NumberInput`, sliders) | `useDebouncedOptionalNumberField` | `src/app/hooks/useDebouncedOptionalNumberField.ts` |

Both share the same commit model:

1. **Local draft** updates immediately on `onChange` (`setNameFilter` / `setValue`).
2. **`useDebouncedValue`** (Mantine) settles after a short interval (Codeplug Studio uses **300 ms** for name filters — pick a value that keeps engine re-runs feeling live without recomputing on every drag tick).
3. **`isTypingRef` / `isEditingRef`** blocks external `committed` hydration while the user is editing.
4. **Commit** runs only when debounced draft ≠ committed and the user was editing.
5. **Number fields / sliders:** call **`flush()` on `onBlur`** (or on drag-end) so releasing the control saves before debounce elapses.

### Wiring

```tsx
const { nameFilterInput, setNameFilter, nameFilterPending } = useDebouncedNameFilter(
  committedNameFilter,
  commitNameFilter,
);

<TextInput
  value={nameFilterInput}
  onChange={(e) => setNameFilter(e.currentTarget.value)}
  rightSection={nameFilterPending ? <Loader size={16} /> : undefined}
/>
```

```tsx
const field = useDebouncedOptionalNumberField(committedFrequency ?? undefined, onCommit);

<NumberInput value={field.value} onChange={field.setValue} onBlur={field.flush} />
```

### Do not

- Call a commit/persist function on every `onChange` for text, number, or slider inputs.
- Set `disabled={saving}` on inputs that persist via debounce — it drops focus mid-edit.
- Sync local draft from `committed` when editing ends **before** `committed` updates (sync only when `!isTypingRef` and `committed` changes — the hooks handle this).
- Clear an `editingField` flag on blur and then `useEffect` reset from stale props (same bug class).
- Recompute the propagation engine on every keystroke/drag tick — debounce the trigger, not just the persisted value.

### Tests

Mirror `useDebouncedNameFilter.test.ts` / `useDebouncedOptionalNumberField.test.ts` from Codeplug Studio: fake timers, assert no commit until debounce, assert `flush` before debounce, assert external hydrate does not clobber pending draft.

## When not to use the default

| Scenario | Approach | Example |
| --- | --- | --- |
| **Filter-only** (no persistence) | Inline `useDebouncedValue` on local state; debounced value drives filter | A local search-only field with no persisted state |
| **Debounced API fetch** | Inline debounce + `useEffect` with cancellation; custom ms per policy | Geocoder autocomplete for a location field |

See [references/other-patterns.md](references/other-patterns.md) for the Codeplug Studio file pointers this was ported from.

## Docs

Document the chosen debounce intervals and commit schedule in the relevant feature doc once implemented, per [feature-docs](../feature-docs/SKILL.md).
