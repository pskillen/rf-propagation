# Station model, persistence, URL codec, TX power and noise environment

## Purpose

Covers the typed `Station` model, its fail-soft `localStorage`
persistence, its lossy registration with phase 5's URL state codec, the
default station a first-time visitor sees, and the TX power / noise
environment inputs. Not covered here: the QTH picker's four conveniences
(see [qth-picker.md](qth-picker.md)) or the antenna pattern math (see
[antenna-model.md](antenna-model.md)).

## Code anchors

- `src/core/domain/station/types.ts` — `Station`, `AntennaConfig`,
  `QthLocation`, `QthSource`, `AntennaPatternFamily`, `isValidStation`.
- `src/core/domain/station/defaults.ts` — `DEFAULT_STATION`,
  `DEFAULT_QTH_LAT`/`DEFAULT_QTH_LON`.
- `src/integrations/station/persistence.ts` — `loadStation`,
  `saveStation`, `mergeStation`.
- `src/app/lib/urlState/types.ts` — `StationUrlState` on `ViewerUrlState`.
- `src/app/lib/urlState/fields/station.ts` — `stationFieldCodec`.
- `src/app/components/station/StationBar.tsx` — fills `AppChrome`'s
  `stationBar` slot; owns the live `Station` React state.
- `src/app/components/station/PowerInput.tsx`,
  `src/app/components/station/NoiseEnvironmentControl.tsx`.

## `Station` shape

```ts
export interface AntennaConfig {
  id: string;
  name: string;
  family: AntennaPatternFamily;
  heightM: number;
  azimuthDeg?: number; // required in practice for 'directional-lobe'
  wireLengthWavelengths?: number; // 'multi-lobe-conical' only
  gainDbi: number; // absolute nominal gain in dBi — see antenna-model.md
}

export interface QthLocation {
  lat: number;
  lon: number;
  locator: string;
  source: 'geolocation' | 'maidenhead' | 'address' | 'map' | 'default';
  label?: string;
}

export interface Station {
  qth: QthLocation;
  antennas: AntennaConfig[];
  activeAntennaId: string;
  powerW: number;
  noiseEnvironment: NoiseEnvironment; // @core/domain/propagation/noise.ts, imported not redeclared
}
```

Two shapes are load-bearing for later phases and were kept exactly as
specified: `AntennaConfig.gainDbi` is a plain `number` in dBi, feeding
phase 3's `LinkBudgetInput.txAntennaGainDbi`/`rxAntennaGainDbi`
unchanged — no unit conversion at any call site. `Station.noiseEnvironment`
is phase 3's own `NoiseEnvironment` type
(`src/core/domain/propagation/noise.ts`), imported, never redeclared as a
lookalike string union.

## Fail-soft persistence

Ported pattern (not a literal copy — this app has no `projectId`
scoping) from Codeplug Studio's `src/integrations/listPrefs/storage.ts`:
every `localStorage` read/write wraps in try/catch, returning `null`
(reads) or no-op (writes) on failure rather than throwing.

`loadStation()` layers a second check on top of the JSON parse: the
parsed value must also pass `isValidStation()` — a structural guard
checking `qth`, a non-empty `antennas` array where every entry has a
known `family` literal and finite numeric fields, `activeAntennaId`
matching one of the antennas' ids, a positive finite `powerW`, and a
`noiseEnvironment` that's one of the four known literals. A schema that
has drifted between app versions degrades exactly like truncated JSON —
`loadStation()` returns `null`, not a throw or a half-repaired object.

`mergeStation(patch)` is the single write path every Station-editing
component uses: `loadStation() ?? DEFAULT_STATION`, spread-merge the
patch on top, save, return the merged `Station`.

```ts
const STATION_STORAGE_KEY = 'rf-propagation.station.v1';
```

## Default station — no setup gate

```ts
export const DEFAULT_STATION: Station = {
  qth: {
    lat: 52.4862,
    lon: -1.8904,
    locator: coordsToLocator(52.4862, -1.8904),
    source: 'default',
  },
  antennas: [
    {
      id: 'default-dipole',
      name: '40m dipole',
      family: 'bidirectional-transverse',
      heightM: 7,
      gainDbi: 2.1,
    },
  ],
  activeAntennaId: 'default-dipole',
  powerW: 100,
  noiseEnvironment: 'rural',
};
```

Deliberately mirrors the product doc set's own worked example of the
mobile Station bar summary — "GM4XYZ · IO75 · 40m dipole @ 7 m ·
100 W" — verbatim: 40m dipole, 7m height, 100W. Two values are
judgment calls with no doc-set source: the QTH (central England;
UK-based since the amateur band allocations phase 7 ports are UK
Ofcom-sourced) and `noiseEnvironment: 'rural'`. The locator is computed
programmatically (`coordsToLocator`) at module load rather than
hand-written, to avoid transcription error.

`StationBar` boots with `loadStation() ?? DEFAULT_STATION` and always
renders a populated station — no wizard, empty state, or modal. TX
power stays visible and functional in the compact row itself (not
behind the "Edit station" toggle), so a meaningful change is reachable
in one interaction even for a first-time visitor whose only antenna is
the default dipole.

## URL codec registration

`StationUrlState` (on `app/lib/urlState/types.ts`'s `ViewerUrlState`) is
a deliberately **lossy** subset — QTH coordinates, the active antenna's
pattern family, power and noise environment round-trip; the full
antenna array and antenna names/heading/gain do not. A full antenna
library in a query string is heavier than a shareable permalink needs;
the permalink feature itself (FR-35) doesn't ship until phase 10.

```ts
export interface StationUrlState {
  qlat?: number;
  qlon?: number;
  ant?: string; // active antenna's pattern family
  pwr?: number;
  noise?: NoiseEnvironment;
}
```

**Judgment call, flagged:** every field is an _override_, not a value
with its own populated default. `encode()` omits a field exactly when
it's `undefined` in the input; `decode()` falls back to
`defaults.station`'s corresponding field, which is `undefined` for
every field on `DEFAULT_VIEWER_URL_STATE.station` (`{}`). This phase's
codec is not compared against `DEFAULT_STATION`'s populated values
(e.g. it won't specifically shorten a URL that happens to match the
default station) — `encode()`'s own signature
(`(value, params)`, no `defaults` argument) has no way to receive a
populated default to compare against, and importing
`@core/domain/station/defaults.ts` into the codec just to shorten the
common case would be doing more than this phase's acceptance criteria
ask for ("the registration mechanism and a reasonable field set exist
and round-trip"). No component constructs a `StationUrlState` from a
live `Station` yet, either — round-tripping is exercised at the codec
level only (`fields/station.test.ts`), the same "built, not yet wired"
state phase 5 left `useViewerUrlState` in. Revisit both if phase 10's
permalink feature finds either insufficient.

```ts
// codec.ts — the one line this phase appends:
const FIELD_CODECS: UrlStateFieldCodec<any>[] = [surfaceFieldCodec, stationFieldCodec];
```

## TX power and noise environment

`PowerInput` writes `mergeStation({ powerW })`. Commits on blur or
Enter, not per-keystroke — a local draft + commit-on-blur pattern
(React's own "adjust state during render" idiom for resetting the draft
when the committed prop changes externally, not a `useEffect`, since a
synchronous `setState` inside an effect on every external `powerW`
change would trigger a cascading extra render). This is a lighter
version of the [debounced-inputs](../../../.skills/debounced-inputs/SKILL.md)
skill's committed+commit hook pattern, not a full port of
`useDebouncedOptionalNumberField` — flagged in the component's own
comment, since this field has no drag/slider and no expensive
recompute to debounce against, just the same "don't write every
keystroke" concern the skill's hooks solve more generally.

`NoiseEnvironmentControl` is a `SegmentedControl` over the four
`NoiseEnvironment` literals, imported from `noise.ts` (never a
hardcoded parallel string list):

```ts
const NOISE_ENVIRONMENT_LABELS: Record<NoiseEnvironment, string> = {
  quietRural: 'Quiet rural',
  rural: 'Rural',
  residential: 'Residential',
  urban: 'Urban',
};
```

Neither field calls the propagation engine — "feeding EIRP" / "feeding
F2.7" means the field exists and is the right shape for phase 3's
`eirpDbm`/`noiseFloorDbm` formulas to consume; phase 8 (Reach) is the
first caller.

## Browser storage

- `rf-propagation.station.v1` — the full `Station` JSON. Never commit
  values; this is per-browser operator data (per
  [AGENTS.md](../../../AGENTS.md) working principle 5).

## Manual verify

```sh
npm run dev
```

- Clear `localStorage` (or use a fresh profile) and load the app — the
  Station bar shows the default dipole/QTH/power summary immediately,
  no gate.
- Change the TX power field without clicking "Edit station" — it
  works, and the summary line updates.
- Reload — the changed power persists.
- Manually corrupt `localStorage['rf-propagation.station.v1']` (set it
  to `not json`) and reload — the app boots to the default station, no
  crash.

## Known gaps

- `StationUrlState` is registered but not yet wired to a live
  `Station` anywhere in the UI — round-tripping is codec-level only.
  Phase 10's permalink feature is the first real consumer.
- `PowerInput`/antenna add-form numeric fields don't reject
  out-of-range real-world values (absurd power, antenna height) —
  that's FR-30/phase 10's realism-unlock, not this phase's job.

## Related

- [README.md](README.md) — feature hub, implementation status
- [qth-picker.md](qth-picker.md)
- [antenna-model.md](antenna-model.md)
