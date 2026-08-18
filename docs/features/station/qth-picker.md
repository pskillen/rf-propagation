# QTH picker — four synchronised conveniences

## Purpose

Covers `QthPicker` and the four ways it can set the operator's QTH —
browser geolocation, Maidenhead locator entry, address search, and a
draggable map pin — and how they stay in sync. Not covered here: the
`Station` model itself or persistence mechanics (see
[station-model.md](station-model.md)).

## Code anchors

- `src/app/components/station/QthPicker.tsx` — the four conveniences,
  the single `setQth` write path.
- `src/app/components/station/QthMap.tsx` — the Leaflet pin (renamed
  from Codeplug Studio's `ObserverLocationMap.tsx`).
- `src/app/components/station/UseMyLocationButton.tsx`,
  `src/app/hooks/useGeolocation.ts`, `src/app/lib/geolocation.ts` —
  geolocation.
- `src/core/domain/maidenhead.ts` — locator ↔ coordinate conversion.
- `src/integrations/geocode/` — the Photon-backed geocoder
  (`types.ts`, `geocode.ts`, `photonClient.ts`, `index.ts`).

## Design: one setter, four routes in

```ts
function setQth(next: { lat: number; lon: number; source: QthSource; label?: string }) {
  const locator = coordsToLocator(next.lat, next.lon);
  onStationChange(mergeStation({ qth: { ...next, locator } }));
}
```

Every route — the geolocation button's `onLocation`, the Maidenhead
"Set" button, an address search result's `onSelect`, the map pin's
`onChange` — ends by calling this one function. The four conveniences
are synchronised **by construction** (one source of truth updated four
ways), not by four independently-maintained pieces of state kept
consistent by hand. This adapts Codeplug Studio's
`ObserverLocationSettings.tsx` sync pattern; the port changes only the
geocoder (Photon here, Nominatim there) and drops Studio's
`positionSource`-per-project scoping (this app has one Station, not a
per-project settings object).

## Geolocation

`UseMyLocationButton` wraps `useGeolocation()`, which wraps
`requestCurrentPosition()` (`src/app/lib/geolocation.ts`) —
`navigator.geolocation.getCurrentPosition` with a 15s timeout, mapped
to a `GeolocationError` with a human-readable message per error code
(permission denied / position unavailable / timed out). The button
renders its own inline error text; **it does not disable or otherwise
touch the Maidenhead field, address combobox, or map** — they're
separate components with no shared `disabled` state, so a geolocation
failure structurally cannot block the other three routes (F4.2's
specific acceptance criterion).

## Maidenhead locator

`isValidLocator()` accepts 4/6/8/10-character locators;
`locatorToCoords()` converts to a `{ lat, lon }` centre point.
Round-trip precision: 4 chars → whole-degree square centre; 6 chars
(the default `coordsToLocator()` precision) → sub-degree; 8/10 →
progressively finer. Entering an invalid locator shows an inline error
and does not call `setQth`.

## Address search (Photon)

Debounced (`ADDRESS_SEARCH_DEBOUNCE_MS = 300`, matching Studio's own
constant), minimum 3 characters
(`MIN_ADDRESS_QUERY_LENGTH = 3`) before a request fires. `geocodeQuery()`
(`@integrations/geocode`) defaults to Photon whenever no `mapboxToken`
is supplied — this app never supplies one, so every call routes to
Photon's `https://photon.komoot.io/api/?q=<query>&limit=1`.

**Deliberate simplification, flagged:** Studio's `photonClient.ts`
routes requests through a shared `fetchCachedText` helper
(`@integrations/http/cachedFetch.ts`/`sessionCache.ts`) for response
caching and rate-limit handling. This app's `photonClient.ts` uses a
plain `fetch` instead — same URL shape, same response parsing
(`parsePhotonGeocodeBody`/`parsePhotonReverseBody`), same error
messages for network failures and non-2xx responses — because the
shared caching layer pulls in infrastructure this app doesn't
otherwise need. **Verified live (2026-08-17):** Photon's endpoints
return `access-control-allow-origin: *` for cross-origin requests, so
no Cloudflare Pages Function proxy is needed.

## Map pin (`QthMap`)

Leaflet + `react-leaflet` v5. Click anywhere to place a pin; drag an
existing pin to adjust (`dragend` → `onChange`). The pin icon
(`L.divIcon`) is a **module-level singleton**, not created per render —
`react-leaflet`'s `Marker` diffs `icon` by reference and calls
`marker.setIcon()` on every change; a fresh-per-render icon corrupted
Leaflet's drag state and crashed the map in Studio's own live testing
(see the component's own comment). `leaflet/dist/leaflet.css` is
imported at this component's own module level, not globally at the app
root, so the CSS isn't pulled into every route's bundle — `QthMap` is
the only Leaflet consumer in the app so far, and it's only reachable
behind the Station bar's "Edit station" toggle. Dragging the pin is the
primary gesture (FR-28); the Maidenhead coordinate field is the
documented fallback.

## Manual verify

```sh
npm run dev
```

- Click "Edit station" → "Use my location" (grant permission) — the
  Maidenhead field, current-QTH summary, and map pin all update.
- Deny geolocation permission — an inline error appears; the
  Maidenhead field, address search, and map remain interactive.
- Type a locator (e.g. `IO92aq`) and click "Set" — the map re-centres
  there.
- Search an address (≥3 characters) and pick a result — QTH updates,
  locator recomputes.
- Drag the map pin — the Maidenhead field updates live, no drift on
  re-drag.
- Resize to 360px width — no horizontal scrollbar on the picker.

## Known gaps

- No client-side rate limiting on Photon address search beyond the
  300ms debounce (Studio's shared caching layer handled Nominatim's
  1 req/s policy; this simplification drops that for Photon, which
  doesn't publish an equivalently strict limit).
- `QthMap` always starts at a world view (zoom 2) when no `value` is
  set; in practice `StationBar` always has a `Station.qth`, so this
  path is unreachable in this app — kept from the port for parity with
  Studio's own component contract.

## Related

- [README.md](README.md) — feature hub, implementation status
- [station-model.md](station-model.md)
