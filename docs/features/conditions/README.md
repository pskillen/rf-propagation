# Conditions

**Conditions** — when, under what solar/geomagnetic activity, over what
ground, on what band — is the second and last input (with Station,
phase 6) every answer surface from phase 8 onward depends on. mk1
deferred live space weather entirely, offering only canned presets; this
phase is what makes "tells an operator whether to call *now*" possible:
live NOAA SWPC data by default, a full fallback chain when it isn't
available, and provenance that's always visible so the operator never
has to guess which of the four states they're looking at.

Nothing in this phase calls the propagation engine — no imports from
`src/core/domain/propagation/`. Phase 8 (Reach) is the first thing to
feed `Conditions.driver.sfi`/`.kp`, `Conditions.atMs`, `Conditions.ground`
and the selected band's frequency into `computeCoverageGrid`.

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| `Conditions`/`ConditionsDriver` model | Shipped | SFI as plain `number` (not SSN), Kp as plain 0–9 `number` (not NOAA's alphanumeric encoding) — the unit contract phase 8 depends on — [conditions-model.md](conditions-model.md) |
| "Now" toggle + time scrubber | Shipped | `useConditions` ticks `atMs` to `Date.now()` roughly once a second while `liveNow`; a bespoke drag-first `TimeScrubber` (±48h), not a native picker, with a `datetime-local` fallback — [conditions-model.md](conditions-model.md) |
| URL codec registration | Shipped | `conditionsFieldCodec` + `bandFieldCodec` registered with phase 5's `FIELD_CODECS`; `ConditionsBar` is the first live wiring of `useViewerUrlState`, debouncing the time-scrub write — [conditions-model.md](conditions-model.md) |
| NOAA SWPC live space weather | Shipped | `fetchLatestSpaceWeather` — plain fetch, no proxy, no query params, no location data sent — [space-weather.md](space-weather.md) |
| Fallback chain + provenance | Shipped | `useConditionsDriver`: live → last-known (age shown) → manual → preset, always-visible provenance text, silent degradation on fetch failure — [space-weather.md](space-weather.md) |
| Conditions bar chrome | Shipped | Fills `AppChrome`'s `conditionsBar` slot; compact summary + always-visible provenance + an "Edit conditions" affordance expanding the scrubber/driver/ground/band controls |
| Amateur-HF band catalogue + chips | Shipped | Ten bands (160m–10m) ported and trimmed from Studio's `bandCatalog.ts`; `BandChips` + a clamped `FrequencyField` — [band-catalog.md](band-catalog.md) |
| Propagation engine wiring | Not started | This phase imports nothing from `src/core/domain/propagation/`. Phase 8 (Reach) is the first caller |
| Time-lapse transport control | Not started | The "now" toggle here is a simple live-tracking flag; the full play/pause/speed/scrub transport is FR-31, phase 10 (F7.1) |
| Per-operator licence class | Not started | Flagged spec gap — see [band-catalog.md](band-catalog.md#licence-class-visibly-distinguished-not-hidden) |

## Documentation map

| Doc | Covers |
| --- | --- |
| [conditions-model.md](conditions-model.md) | `Conditions`/`ConditionsDriver` shapes, the SFI/Kp unit contract, `useConditions`'s now-toggle, `TimeScrubber`, URL codec registration and the debounced write |
| [space-weather.md](space-weather.md) | The NOAA SWPC integration, the live → last-known → manual → preset fallback chain, provenance display |
| [band-catalog.md](band-catalog.md) | The trimmed amateur-HF `bandCatalog.ts`, `BandChips`, the clamped frequency field, and the licence-class spec gap |

## Concepts

- **Driver** — the solar/geomagnetic input pair (SFI, Kp) and where it
  came from (`ConditionsDriver.kind`: `'live' | 'manual' | 'preset'`).
- **Provenance** — the always-visible text telling the operator which
  of the four fallback-chain states (live / last-known / manual /
  preset) they're looking at. `'live'` and `'last-known'` share the
  same `kind` literal; they're distinguished by the age shown, e.g.
  "Live (0 min ago)" vs. "Live (43 min ago)".
- **SFI vs SSN** — `ConditionsDriver.sfi` is the plain 10.7cm Solar Flux
  Index, *not* Sunspot Number. The SFI→SSN conversion (`ssnFromSfi`)
  happens inside phase 3's `losses.ts`/`linkBudget.ts`, never in this
  phase.
- **Band** — a trimmed, ported `BandDefinition` from
  `@core/domain/bandCatalog`; `bandId` lives as a sibling of
  `conditions` on `ViewerUrlState`/`ViewerState`, not nested inside it.

## Cross-links

- Tracking: [Feature #6 "Station and Conditions"](https://github.com/pskillen/rf-propagation/issues/6) (parent epic [#2](https://github.com/pskillen/rf-propagation/issues/2))
- Task issues (phase 7): [#46](https://github.com/pskillen/rf-propagation/issues/46)–[#48](https://github.com/pskillen/rf-propagation/issues/48)
- Reference source (read-only, not linked from committed docs per [AGENTS.md](../../../AGENTS.md)): Codeplug Studio's `src/core/domain/bandCatalog.ts` (ported/trimmed); no direct NOAA SWPC integration exists in Studio to port from — that part is genuinely new to this app.
