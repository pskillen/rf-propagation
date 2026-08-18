# Conditions model, now-toggle, time scrubber, URL codec

## Purpose

Covers the typed `Conditions`/`ConditionsDriver` model, the SFI/Kp unit
contract phase 8 depends on, the `useConditions` live-tick "now" toggle,
the bespoke `TimeScrubber` control, and Conditions' lossy registration
with phase 5's URL state codec (including the debounced write). Not
covered here: the NOAA SWPC fetch and fallback chain (see
[space-weather.md](space-weather.md)) or the band catalogue
(see [band-catalog.md](band-catalog.md)).

## Code anchors

- `src/core/domain/conditions/types.ts` — `Conditions`, `ConditionsDriver`,
  `ConditionsDriverKind`.
- `src/core/domain/conditions/defaults.ts` — `DEFAULT_CONDITIONS`.
- `src/app/hooks/useConditions.ts` — the now-toggle/scrub hook.
- `src/app/components/conditions/TimeScrubber.tsx` — the drag-first
  control + `datetime-local` fallback.
- `src/app/lib/urlState/types.ts` — `ConditionsUrlState`,
  `DEFAULT_BAND_ID` on `ViewerUrlState`.
- `src/app/lib/urlState/fields/conditions.ts` — `conditionsFieldCodec`,
  `conditionsUrlStateToInitialTime`.
- `src/app/components/conditions/ConditionsBar.tsx` — fills `AppChrome`'s
  `conditionsBar` slot; owns the live runtime state and the debounced
  URL write.

## `Conditions` shape

```ts
export type ConditionsDriverKind = 'live' | 'manual' | 'preset';

export interface ConditionsDriver {
  kind: ConditionsDriverKind;
  sfi: number; // plain SFI, NOT SSN
  kp: number; // plain 0-9, NOT NOAA's alphanumeric kp string
  fetchedAtMs?: number; // when a 'live' value was actually fetched
  presetId?: string; // when kind === 'preset'
}

export interface Conditions {
  atMs: number;
  liveNow: boolean; // true => atMs tracks Date.now()
  driver: ConditionsDriver;
  ground: GroundType; // @core/domain/propagation/losses.ts, imported not redeclared
}
```

**The load-bearing unit contract, unchanged from the plan:**
`driver.sfi` is a plain Solar Flux Index, never SSN — the SFI→SSN
conversion (`ssnFromSfi`) lives inside phase 3's `losses.ts`, and is
never called from this phase. `driver.kp` is a plain 0–9 number,
converted from NOAA's alphanumeric `kp` classification (e.g. `"1M"`) at
the `@integrations/spaceWeather/noaaClient` boundary — see
[space-weather.md](space-weather.md). `Conditions.ground` imports phase
3's `GroundType` from `losses.ts`, same "import, don't redeclare"
pattern as Station's `noiseEnvironment`.

## Default conditions

```ts
export const DEFAULT_CONDITIONS: Conditions = {
  atMs: Date.now(),
  liveNow: true,
  driver: { kind: 'preset', sfi: 120, kp: 2 },
  ground: 'land',
};
```

SFI 120 / Kp 2 is not an arbitrary "quiet, moderate" guess — it matches
phase 3's own Anchor A calibration scenario (14 MHz, daytime, SFI 120,
rural, 100W into 6dBi), so a fresh visitor's first coverage picture
(once Reach exists in phase 8) matches the model's own validated
reference case.

## The "now" toggle

`useConditions({ atMs, liveNow })` owns exactly the toggle behaviour:

- While `liveNow` is true, a ~1s `setInterval` ticks `atMs` forward to
  `Date.now()`.
- `scrubTo(nextAtMs)` — a manual scrub or explicit time entry — fixes
  `atMs` and turns `liveNow` off.
- `goLive()` resumes live tracking from `Date.now()`.

This is **not** the full play/pause/speed/scrub transport control
(FR-31, phase 10/F7.1) — just the live-tracking flag.

## `TimeScrubber`

A Mantine `Slider` (same direct-manipulation-primary pattern the kit's
`PercentLevelSlider` already establishes), not a native
`<input type="datetime-local">` picker — a `datetime-local` fallback
still exists alongside it for precise entry, per the "direct
manipulation primary, field secondary" pattern Station's QTH picker and
antenna heading already establish.

**Judgment call, flagged:** the slider spans ±48h around the moment the
component mounts (anchored once via a lazy `useState` initializer, not
`Date.now()` called during render — React's render-purity lint rule
flags the latter). Neither doc specifies scrub bounds; this is this
phase's own reasonable default.

Dragging the control cannot yet make "the world" visibly respond
(FR-27) — no surface reads `Conditions` yet. This component only
guarantees the control itself is scrub-first; the live-response
property becomes observable once Reach (phase 8) exists.

## URL codec registration

```ts
// app/lib/urlState/types.ts
export interface ConditionsUrlState {
  t?: number; // atMs, present only when liveNow is false
  dk?: ConditionsDriverKind; // present only when driver.kind !== 'live'
  sfi?: number; // present only when driver.kind !== 'live'
  kp?: number; // present only when driver.kind !== 'live'
  gnd?: GroundType;
}
```

**Judgment call, flagged:** `dk`/`sfi`/`kp` are omitted whenever
`driver.kind === 'live'` — a live snapshot value isn't meaningful to
encode in a shareable link (the recipient's own live fetch should
apply); `'manual'`/`'preset'` values, by contrast, are exactly what a
shared permalink needs to reproduce. This mirrors `t`'s own "absent
means default live behaviour" pattern. Neither doc specifies this
omission rule explicitly.

```ts
// codec.ts — this phase's two appends:
const FIELD_CODECS: UrlStateFieldCodec<any>[] = [
  surfaceFieldCodec,
  stationFieldCodec,
  conditionsFieldCodec,
  bandFieldCodec,
];
```

`conditionsUrlStateToInitialTime(urlState)` is a small, pure, separately
tested function implementing "a URL with no `t` param means now": absent
`t` maps to `{ atMs: Date.now(), liveNow: true }`; a present `t` maps to
`{ atMs: t, liveNow: false }`. `ConditionsBar` uses it once, at mount,
to seed `useConditions`'s initial state from a shared permalink.

### Debounce the write, not the render

Unlike Station (phase 6), which never wires `useViewerUrlState` at
runtime, `ConditionsBar` is the first live caller — because
`TimeScrubber`'s drag changes continuously and phase 5 explicitly
flagged this field as needing it. The pattern, per the
[debounced-inputs](../../../.skills/debounced-inputs/SKILL.md) skill's
"debounce the write, not the render" convention:

- `atMs` (from `useConditions`) updates the visible slider position
  immediately — no debounce on the rendered value.
- `useDebouncedValue(atMs, 300)` (Mantine, matching `QthPicker`'s own
  `ADDRESS_SEARCH_DEBOUNCE_MS`) produces a settled value.
- A `useEffect` writes the full `ConditionsUrlState` + `bandId` to the
  URL (via `history.replaceState`) only when the debounced value (or
  any of the non-continuous fields: `liveNow`, driver kind/sfi/kp,
  `ground`, `bandId`) changes.

`urlState` itself is deliberately excluded from that effect's
dependency array — including it would re-fire the effect on every write
this same effect makes (a new decoded object identity from the same
search-string change), not just on a real change in Conditions' own
fields. `surface`/`station` are read fresh from the latest render's
`urlState` when the effect does run; since nothing else in the app
currently writes to this shared URL state, there's no concurrent-writer
risk to guard against yet.

## Manual verify

```sh
npm run dev
```

- Load the app — the Conditions bar shows a compact summary (band,
  frequency, SFI, Kp, provenance) with no gate.
- Click "Edit conditions" — the time scrubber, manual SFI/Kp fields,
  ground selector and band chips appear.
- Drag the time scrubber — the displayed time updates immediately;
  after it settles, the URL's `t` param appears (liveNow turns off).
- Toggle "Live now" back on — `t` disappears from the URL, the time
  resumes ticking.

## Known gaps

- `TimeScrubber`'s ±48h range is a judgment call, not a documented
  spec value.
- No surface yet visibly reacts to a Conditions change (FR-27's "world
  responds during the drag" is unverifiable until phase 8).

## Related

- [README.md](README.md) — feature hub, implementation status
- [space-weather.md](space-weather.md)
- [band-catalog.md](band-catalog.md)
