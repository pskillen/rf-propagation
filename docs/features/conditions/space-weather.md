# NOAA SWPC integration, fallback chain, provenance

## Purpose

Covers the live NOAA SWPC space-weather fetch, the fail-soft
last-known-driver persistence, the four-tier fallback chain
(live → last-known → manual → preset), and the always-visible
provenance display. Not covered here: the `Conditions`/`ConditionsDriver`
shape itself (see [conditions-model.md](conditions-model.md)).

## Code anchors

- `src/integrations/spaceWeather/noaaClient.ts` — `fetchLatestSpaceWeather`,
  `SpaceWeatherReading`.
- `src/integrations/conditions/persistence.ts` — `loadLastKnownDriver`,
  `saveLastKnownDriver`.
- `src/app/hooks/useConditionsDriver.ts` — the fallback-chain state
  machine, `describeDriverProvenance`.
- `src/app/components/conditions/ManualDriverFields.tsx` — the manual
  SFI/Kp entry fields.
- `src/app/components/conditions/ConditionsBar.tsx` — renders the
  provenance text next to SFI/Kp, always.

## NOAA SWPC endpoints

```
GET https://services.swpc.noaa.gov/json/f107_cm_flux.json
GET https://services.swpc.noaa.gov/json/planetary_k_index_1m.json
```

Both confirmed CORS-open (`access-control-allow-origin: *`) and take
**no query parameters at all** — true by construction that no location
data is ever sent with either request; no Pages Function proxy is
needed. Both cache upstream at `max-age=60`.

**SFI** is the `flux` field of the `frequency === 2800` (2800 MHz =
10.7cm band) record with the latest `time_tag` in `f107_cm_flux.json` —
that feed is one entry per (frequency, reporting-schedule) combination,
most-recent-`time_tag` first, but the frequency is filtered explicitly
rather than assuming index `0` is always the 2800 MHz record.

**Kp** is the `kp_index` field (a plain integer 0–9) of the *last*
element of `planetary_k_index_1m.json` — that feed is ordered
**ascending** by `time_tag` (oldest first, the opposite order from the
flux feed). `estimated_kp` (a finer nowcast float) and `kp` (NOAA's
alphanumeric classification, e.g. `"1M"`) are deliberately never used —
`kp_index` is the field whose units match every downstream consumer
(phase 2's `layerStates(sfi, kp, ...)`).

```ts
export interface SpaceWeatherReading {
  sfi: number;
  kp: number;
  observedAtMs: number;
}

export async function fetchLatestSpaceWeather(): Promise<SpaceWeatherReading>;
```

Throws (never returns a partial/invalid reading) on a non-OK response
or a missing expected field — the caller (`useConditionsDriver`) is
responsible for catching and degrading, never this function.

## The fallback chain

`useConditionsDriver(initialManual?)`, in exactly F4.7's order:

1. **Live** — `fetchLatestSpaceWeather()` on mount and every 60s (the
   client-side guard matching the upstream's own `max-age=60`, tracked
   via a `lastFetchAttemptMsRef` so overlapping intervals/remounts don't
   re-fetch more often than that). On success: `driver = { kind: 'live', sfi, kp, fetchedAtMs }`,
   persisted via `saveLastKnownDriver`.
2. **Last-known** — on fetch failure, the driver simply isn't
   overwritten: the previously-persisted `'live'` driver (loaded
   synchronously at mount via `loadLastKnownDriver()`) stays current,
   its `fetchedAtMs` naturally ageing into a larger "(N min ago)" as
   time passes. This is **not** a second cache with its own TTL.
3. **Manual** — `setManualDriver(sfi, kp)` (wired from
   `ManualDriverFields`'s commit-on-blur/Enter fields, same pattern as
   Station's `PowerInput`) takes precedence over both of the above until
   `clearManualDriver()` is called ("switch back").
4. **Preset** — if there's never been a successful live fetch *and* no
   manual entry, falls back to `DEFAULT_CONDITIONS.driver` (SFI 120,
   Kp 2 — see [conditions-model.md](conditions-model.md) for why those
   specific values).

A rejected fetch is caught inside the hook and never rethrown — no
component boundary needs an error UI, and the UI just falls through to
the next tier on its own next render.

## Provenance

`describeDriverProvenance(driver, nowMs?)`:

| `driver.kind` | Text |
| --- | --- |
| `'live'` (fresh or last-known) | `Live (N min ago)`, `N = round((nowMs - fetchedAtMs) / 60000)` |
| `'manual'` | `Manual` |
| `'preset'` | `Preset` |

**`'live'` and last-known share the same `kind` literal** — there's no
fourth enum value for "stale." The operator tells them apart from the
age text itself: "(0 min ago)" reads as fresh, "(43 min ago)" reads as
stale. `ConditionsBar` renders this text unconditionally next to the
SFI/Kp values, in all four states — never only on the live path, per
the product doc set's "Solar inputs show provenance inline" honesty
requirement (`tmp/mvp-plan/ux-and-ia.md` §8 — gitignored scratch space,
not linked here per [AGENTS.md](../../../AGENTS.md)).

## Browser storage

- `rf-propagation.conditions.lastKnownDriver.v1` — the last
  successfully-fetched `'live'` `ConditionsDriver` JSON (`kind`, `sfi`,
  `kp`, `fetchedAtMs`). Never commit values; per-browser operator data.

## Manual verify

```sh
npm run dev
```

- On a real network — the Conditions bar shows "Live (0 min ago)" (or
  a small number of minutes) with real SFI/Kp values shortly after
  load.
- Open devtools, go offline, reload — the app shows either the
  previous session's last-known driver (with its age) or "Preset", no
  modal, no uncaught console error.
- Type a manual SFI/Kp and blur — provenance switches to "Manual";
  click "Use live/last-known" — it switches back.

## Known gaps

- The 60s client-side re-fetch guard is a simple timestamp check, not
  a request-cancellation/dedup mechanism — two `ConditionsBar` instances
  mounted simultaneously (not possible in the current single-instance
  app shell) would each maintain their own guard.

## Related

- [README.md](README.md) — feature hub, implementation status
- [conditions-model.md](conditions-model.md)
