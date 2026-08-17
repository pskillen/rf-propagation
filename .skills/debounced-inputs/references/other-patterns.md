# Other debounce patterns (non-default) — source pointers

These hooks and consumers don't exist in rf-propagation yet. Listed here as
the Codeplug Studio source to port from once an equivalent input is built —
delete or rewrite this file once this repo has its own consumers to point at
instead.

## Inline filter debounce (Codeplug Studio examples)

Local state + `useDebouncedValue`; debounced value used in `useMemo` for
filtering. Input binds to immediate state.

| File | Debounce ms | Notes |
| --- | --- | --- |
| `src/app/components/builds/wirePreview/WirePreviewDataTable.tsx` | 300 | `pending: search !== debouncedSearch` on DataTable search |
| `src/app/routes/reference/MaidenheadReferencePage.tsx` | 500 | Autocomplete channel options |
| `src/app/routes/reference/MaidenheadBearingSection.tsx` | 500 | Same |

No `isTypingRef` — nothing external re-hydrates the draft mid-type except parent remount.

## Debounced async fetch (Codeplug Studio examples)

Debounced string triggers network I/O; effect uses cancellation flag.

| File | Debounce ms | Notes |
| --- | --- | --- |
| `src/app/components/library/GeocodeCentreField.tsx` | 400 | `geocodeQuery`; min query length 3 — relevant here for the Station QTH field and Target picker, both ported per the migration doc set |
| `src/app/routes/tracking/ObserverLocationSettings.tsx` | policy-driven | Nominatim 1 req/s comment |

Do not route these through `useDebouncedNameFilter` — commit callback is wrong abstraction.

## Adding a new text persistence field

If the committed value is a string and you need URL/localStorage persistence, **extend or reuse `useDebouncedNameFilter`** rather than duplicating the ref/effect logic.

## Adding a new number/slider persistence field

Reuse `useDebouncedOptionalNumberField`. Map `null` ↔ `undefined` at the boundary if the model uses `null` for empty.
