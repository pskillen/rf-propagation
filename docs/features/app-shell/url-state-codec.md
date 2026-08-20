# URL state codec

## Purpose

A shared link should reproduce the view it was copied from. This page
covers the mechanism every later surface's state registers with: how a
field gets added, how versioning and degrade-to-defaults work, and
exactly which lines a later phase is allowed to touch. Not covered here:
the app shell/routing itself — see
[component-kit-and-shell.md](component-kit-and-shell.md).

## Code anchors

- `src/app/lib/urlState/types.ts` — `ViewerUrlState`, `URL_STATE_VERSION`,
  `DEFAULT_VIEWER_URL_STATE`.
- `src/app/lib/urlState/codec.ts` — `UrlStateFieldCodec`, the
  `FIELD_CODECS` registry, `encodeViewerUrlState`/`decodeViewerUrlState`.
- `src/app/lib/urlState/fields/surface.ts` — the one field codec that
  exists so far.
- `src/app/lib/urlState/codec.test.ts` — round-trip and malformed-input
  tests.
- `src/app/hooks/useViewerUrlState.ts` — reads/writes `ViewerUrlState`
  to/from the current route's query string via
  `react-router-dom`'s `useSearchParams()`.
- `src/app/state/viewerState.tsx` — `ViewerStateProvider`/
  `useViewerState`, the full runtime `ViewerState` container.

## Design

Each domain area owns an independent field-codec module — its own file
under `fields/`, its own tests, written once and never edited again by a
later phase. A single central registry array in `codec.ts` is the _only_
place a later phase touches, and touching it means **appending one import
plus one array entry, never modifying an existing line**:

```ts
export interface UrlStateFieldCodec<K extends keyof ViewerUrlState> {
  key: K;
  encode(value: ViewerUrlState[K], params: URLSearchParams): void;
  decode(params: URLSearchParams, defaults: ViewerUrlState): ViewerUrlState[K];
}

const FIELD_CODECS: UrlStateFieldCodec<any>[] = [surfaceFieldCodec];
```

`FIELD_CODECS`'s element type is `UrlStateFieldCodec<any>` deliberately —
a heterogeneous array of per-key codecs has no key-safe structural type in
TypeScript (each codec's `encode` parameter is contravariant in its own
key's value type). This is the standard escape hatch for that shape, not
a typing shortcut; each field codec's own file (e.g. `fields/surface.ts`)
keeps full key/value type safety for its one field.

A self-registering-import pattern (each field module registering itself
as a side effect of being imported) was considered and rejected as
needless indirection for a client-only SPA with no dynamic plugin
loading.

## Fields so far

| Field                 | Type                                                        | Added                    | Codec                                                                                                                                          |
| --------------------- | ----------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `surface`             | `'reach' \| 'path' \| 'timeline' \| 'explore' \| 'compare'` | Phase 5                  | [`fields/surface.ts`](../../../src/app/lib/urlState/fields/surface.ts)                                                                         |
| `station`             | `StationUrlState`                                           | Phase 6                  | [`fields/station.ts`](../../../src/app/lib/urlState/fields/station.ts)                                                                         |
| `conditions`/`bandId` | `ConditionsUrlState` / `string`                             | Phase 7                  | [`fields/conditions.ts`](../../../src/app/lib/urlState/fields/conditions.ts), [`fields/band.ts`](../../../src/app/lib/urlState/fields/band.ts) |
| `target`              | `TargetUrlState \| undefined`                               | Phase 8                  | [`fields/target.ts`](../../../src/app/lib/urlState/fields/target.ts)                                                                           |
| `globe`               | `GlobeUrlState`                                             | Phase 9                  | [`fields/globe.ts`](../../../src/app/lib/urlState/fields/globe.ts)                                                                             |
| `playback`            | `PlaybackUrlState` (`unrealismUnlocked` only)               | Phase 10 (Slice 4, F7.4) | [`fields/playback.ts`](../../../src/app/lib/urlState/fields/playback.ts)                                                                       |
| `compare`             | `CompareUrlState` (`cmp`/`cant`/`cband`/`cat`)              | Phase 12                 | [`fields/compare.ts`](../../../src/app/lib/urlState/fields/compare.ts)                                                                         |

`playback.playing`/`speedMultiplier` deliberately never round-trip
(playback state is explicitly never persisted — see
[playground-controls.md](playground-controls.md)). `compare` (phase 12)
was the last remaining field from the product doc set's UX/IA state
model; every field is now registered.

Phase 10 (Slice 4, F7.4) is also the first phase to build a mapping from
the FULL `ViewerState` into `ViewerUrlState` (`viewerStateToUrlState`,
`src/app/lib/urlState/fromViewerState.ts`) — the permalink's "Share"
button. Before that, no single writer ever produced a complete
`ViewerUrlState`: `ConditionsBar`'s own url-write effect only ever wrote
the two fields it owns, and Station/target/globe changes never wrote to
the URL live at all (see that doc's own Slice 4 section for the full
story, including a real gap it found and fixed: `stationFieldCodec`
could already DECODE a Station override, but nothing applied the decoded
value until this slice).

## Versioning and degrade behaviour

`encodeViewerUrlState` always writes `v=<URL_STATE_VERSION>`.
`decodeViewerUrlState` reads it and returns
`{ ...DEFAULT_VIEWER_URL_STATE }` outright — skipping every field
codec — if the version is missing/non-numeric or _greater_ than the
current `URL_STATE_VERSION`. Rationale: an unknown or future version means
this build doesn't understand the shape that produced the URL, and
guessing at fields is worse than falling back to defaults. A version at
or below the current one is decoded normally, field by field, via each
registered codec's own `decode`.

This means a stale shared link (e.g. from a build one version behind)
still loads — degraded to defaults, not broken.

## `surface` field's own encoding

`'reach'` is the default surface, so its query param (`s`) is omitted
entirely when the state's surface is `'reach'` — shorter URLs for the
common case. Any other surface writes `s=path` / `s=timeline` /
`s=explore`. Decoding rejects anything that isn't one of the three
non-default `SurfaceId` values and falls back to the default.

## Runtime state vs. URL state

`ViewerUrlState` is deliberately the **URL-serializable subset only** —
some `ViewerState` fields (e.g. `playback.playing`) are explicitly never
persisted to the URL ("nobody wants to reopen the tab into a running
animation"), so the URL codec can't be the app's only state container.

`src/app/state/viewerState.tsx` provides a minimal `ViewerStateProvider`/
`useViewerState` React Context for the full runtime `ViewerState`,
mirroring the URL codec's "grows by addition" discipline — each phase
adds one property to the `ViewerState` interface and one piece of its own
provider logic, never edits another phase's fields. It's mounted once,
above the router, in `App.tsx`:

```tsx
<ViewerStateProvider>
  <RouterProvider router={router} />
</ViewerStateProvider>
```

Because it sits outside the router tree, it can't use
`react-router-dom`'s `useSearchParams()` (that hook requires a router
context). Instead it initialises once, on mount, from
`decodeViewerUrlState(new URLSearchParams(window.location.search))` — so
a shared link's `surface` value is respected on first paint. It does
**not** keep runtime state and the URL in sync on every subsequent
change; the phase 5 plan explicitly leaves that as a later phase's own
concern, since no field beyond `surface` exists yet to need it, and
`surface` itself changes via route navigation, not via this context.

## `useViewerUrlState` — built, not yet wired

`src/app/hooks/useViewerUrlState.ts` wraps `useSearchParams()` to
read/write `ViewerUrlState` from the _current route's_ query string. It
must run inside the router tree. **No component calls it yet** — in this
phase, `surface` is driven entirely by pathname routing (`/`, `/path`,
`/timeline`, `/explore`), not by a `?s=` query parameter, so there's
nothing for it to usefully do yet. It exists as ready infrastructure for
phase 6/7's fields, which will be genuine query-string state (station
config, conditions, band) layered on top of whichever pathname route is
active.

**Debouncing note for phase 7:** this phase's only field changes on
navigation clicks, not drags, so no debouncing was needed. Phase 7's
Conditions time-scrub field changes continuously and must debounce the
URL _write_ (not the render) — see
[`debounced-inputs`](../../../.skills/debounced-inputs/SKILL.md).

## Tests

`codec.test.ts` covers:

- Round-trip (`decode(encode(state)) === state`) for every `SurfaceId`.
- A bogus `s` value combined with a future `v` degrades to
  `DEFAULT_VIEWER_URL_STATE` without throwing.
- Malformed input (non-numeric `v`) doesn't throw.
- A valid version at/below current with a valid `s` decodes correctly.
- An empty `URLSearchParams` decodes to the default state.
- `s` is omitted from the encoded params when the surface is the default
  (`reach`), and present otherwise.

## Related

- [README.md](README.md) — feature hub, implementation status
- [component-kit-and-shell.md](component-kit-and-shell.md)
