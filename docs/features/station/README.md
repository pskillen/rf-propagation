# Station

The operator's **Station** — where they are, what antenna(s) they have,
how much power, and what their local noise environment is like — is one
of the two inputs (with Conditions, phase 7) every answer surface from
phase 8 onward depends on. mk1 had no equivalent at all: Codeplug
Studio's Tracking feature has an _observer location_ for satellite
passes, which this phase's QTH picker adapts, but nothing in Studio
models an antenna, TX power, or a noise environment — those are
genuinely new to this app.

A first-time visitor never sees a setup gate: `DEFAULT_STATION` is a
populated, already-interesting station (a 40m dipole at 7m, 100W,
rural noise, a UK QTH), rendered immediately in the always-visible
Station bar. Setting your own QTH or antenna is offered from within
that bar as an improvement, never a precondition.

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Station model + fail-soft persistence | Shipped | `Station`/`AntennaConfig`/`QthLocation`, `localStorage`-backed with structural-validity fallback — [station-model.md](station-model.md) |
| URL codec registration | Shipped | Lossy `StationUrlState` (QTH coords, active antenna family, power, noise) registered with phase 5's `FIELD_CODECS` — [station-model.md](station-model.md) |
| QTH picker (four conveniences) | Shipped | Geolocation, Maidenhead locator, Photon address search, draggable Leaflet pin — all funnel through one setter — [qth-picker.md](qth-picker.md) |
| Antenna model + absolute dBi | Shipped | Pattern-family gain-shape math ported from mk1, `elevationGainDbi` adds the absolute-dBi layer mk1 never had — [antenna-model.md](antenna-model.md) |
| Antenna editing in place | Shipped (`fix/reach-directionality-antenna-greyline`) | "Edit" replaces an antenna in place instead of requiring a near-duplicate; heading field also exposed for dipoles, not just beams — [antenna-model.md](antenna-model.md) |
| Antenna pattern preview: 3 polar plots | Shipped (`fix/reach-directionality-antenna-greyline`) | Two elevation cuts + one azimuth cut, replacing the original single elevation-only line chart; reflects the in-progress form draft, not just the active antenna — [antenna-model.md](antenna-model.md) |
| TX power + noise environment inputs | Shipped | `PowerInput` (commits on blur/Enter), `NoiseEnvironmentControl` (imports phase 3's `NoiseEnvironment`) — [station-model.md](station-model.md) |
| Station bar chrome | Shipped | Fills `AppChrome`'s `stationBar` slot; compact summary + always-visible TX power field + an "Edit station" affordance expanding QTH/antenna/noise editors |
| Propagation engine wiring | Shipped (phase 8) | [../reach/README.md](../reach/README.md)'s `buildCoverageGridInput.ts` is the first caller of `computeCoverageGrid` with a Station's data (`powerW`, active antenna's `gainDbi`, `noiseEnvironment`) |
| `station` lifted into shared `ViewerState` | Shipped (phase 8) | Reach's live-draggable marker needs to both read and write Station from outside `StationBar` — see [../reach/coverage-surface.md](../reach/coverage-surface.md#deviations) |
| Realism-unlock / draggable heading | Deferred | Antenna heading ships as a numeric `azimuthDeg` field only; a draggable compass-needle control and out-of-range value handling belong to phase 10 (F7.3) |

## Documentation map

| Doc | Covers |
| --- | --- |
| [station-model.md](station-model.md) | `Station`/`AntennaConfig`/`QthLocation` shapes, fail-soft persistence, URL codec registration, TX power and noise environment inputs |
| [qth-picker.md](qth-picker.md) | The four QTH-entry conveniences and their single-setter sync pattern, the Photon geocoder |
| [antenna-model.md](antenna-model.md) | Pattern-family gain-shape math, the `elevationGainDbi` absolute-dBi layer, `AntennaList`/`AntennaPatternPreview` |

## Concepts

- **QTH** — the operator's station location: latitude/longitude, a
  Maidenhead grid locator, and which of the four entry routes produced
  it (`QthSource`).
- **Maidenhead locator** — a compact grid-square encoding of a
  lat/lon pair (e.g. `IO92aq`), amateur radio's standard way to state
  a rough location without exposing an exact address.
- **Absolute dBi** — a calibrated antenna gain figure in dBi, as
  opposed to mk1's pattern-family math, which only ever produced a
  relative shape (`[0, ~2]`, "a multiplicative weight on transmit
  power" per its own doc comment). `Antenna.gainDbi` is the operator's
  stated absolute gain; `elevationGainDbi` scales the relative pattern
  shape to it.
- **Noise environment** — one of `quietRural | rural | residential |
  urban`, phase 3's own `NoiseEnvironment` type (imported here, not
  redeclared), feeding the receive noise floor once phase 8 wires the
  engine call.
- **Station bar** — the persistent chrome slot (phase 5's
  `AppChrome.stationBar`) this phase fills: a compact summary line,
  an always-visible TX power field, and an "Edit station" affordance
  that expands the full QTH picker, antenna switcher/editor, and noise
  environment selector.

## Cross-links

- Tracking: [Feature #6 "Station and Conditions"](https://github.com/pskillen/rf-propagation/issues/6) (parent epic [#2](https://github.com/pskillen/rf-propagation/issues/2))
- Task issues (phase 6): [#41](https://github.com/pskillen/rf-propagation/issues/41)–[#45](https://github.com/pskillen/rf-propagation/issues/45)
- Reference source (read-only, not linked from committed docs per [AGENTS.md](../../../AGENTS.md)): Codeplug Studio's `src/app/routes/tracking/ObserverLocation*.tsx`, `src/app/components/UseMyLocationButton/`, `src/integrations/geocode/`, `src/core/domain/maidenhead.ts`, `src/core/domain/hfPropagation/antennaPatterns.ts`, `src/integrations/listPrefs/storage.ts`
