/**
 * Preset starting points (F7.5, phase 10's Slice 5) — a small, fixed
 * menu of loadable scenarios grounded in the validation harness's own
 * worked examples (`src/core/domain/propagation/validation.test.ts`),
 * per F7.5's own wording ("a textbook skip zone, an NVIS setup, a
 * greyline path, a band above its MUF") and
 * `physics-and-fidelity.md §6`.
 *
 * "Each is a permalink internally, so presets and shared links are the
 * same mechanism" (F7.5's own AC) — every preset here is a canned
 * `ViewerUrlState` override, applied through the EXACT same load path a
 * permalink uses: `PresetMenu` renders each as a plain `<a href>` built
 * from `encodeViewerUrlState`, so clicking one is a real browser
 * navigation — the same "decode on mount" path `ViewerStateProvider`'s
 * `initialViewerState` already uses for any shared link, not a second
 * live-apply mechanism.
 *
 * Station/target coordinates and timestamps below are THIS PHASE'S OWN
 * reasonable approximation of each worked example's scenario (a specific
 * QTH/target pair and a plausible daytime/night instant) -- they do not
 * re-derive the validation harness's own `solarZenithDeg` inputs exactly
 * (the app has no direct "set solar zenith" control; time-of-day is the
 * closest proxy a real operator has). The worked examples themselves are
 * anchored to `frequencyMhz`/`totalGroundRangeKm`/`sfi`/`solarZenithDeg`
 * inputs, not to any specific lat/lon pair -- picking one is this
 * phase's own judgment call, same as everything else in this file.
 */
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { DEFAULT_VIEWER_URL_STATE, type ViewerUrlState } from '../lib/urlState/types.ts';

export interface Preset {
  id: string;
  label: string;
  /** Grounded-in note shown as a tooltip/hint -- which worked example this approximates. */
  groundedIn: string;
  urlState: ViewerUrlState;
}

const STATION_LAT = DEFAULT_STATION.qth.lat; // Birmingham, UK -- reuses the app's own default QTH rather than inventing a new one.
const STATION_LON = DEFAULT_STATION.qth.lon;

// ~1 degree of latitude is ~111km everywhere; longitude degrees shrink by
// cos(latitude) -- both approximations, fine for an illustrative preset
// (not a claim about the great-circle distance the engine itself computes).
const KM_PER_DEGREE_LAT = 111;

function offsetNorthKm(lat: number, km: number): number {
  return lat + km / KM_PER_DEGREE_LAT;
}

function offsetEastKm(lat: number, lon: number, km: number): number {
  const kmPerDegreeLon = KM_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
  return lon + km / kmPerDegreeLon;
}

function preset(
  id: string,
  label: string,
  groundedIn: string,
  override: Partial<ViewerUrlState>,
): Preset {
  return {
    id,
    label,
    groundedIn,
    urlState: { ...DEFAULT_VIEWER_URL_STATE, ...override },
  };
}

export const PRESETS: readonly Preset[] = [
  preset(
    'textbook-skip-zone',
    'Textbook skip zone',
    'V17 -- 20 m, 200 km, vertical antenna, daytime: target sits in the skip zone',
    {
      bandId: '20m',
      station: {
        qlat: STATION_LAT,
        qlon: STATION_LON,
        ant: 'omnidirectional-vertical',
      },
      target: { lat: offsetNorthKm(STATION_LAT, 200), lon: STATION_LON },
      conditions: { dk: 'manual', sfi: 120, kp: 2, t: Date.UTC(2026, 5, 21, 12, 0, 0) },
    },
  ),
  preset(
    'nvis-setup',
    'NVIS setup',
    'V16 -- 40 m, 200 km, low dipole, midday: Good, no skip zone inside 400 km',
    {
      bandId: '40m',
      station: {
        qlat: STATION_LAT,
        qlon: STATION_LON,
        ant: 'bidirectional-transverse',
      },
      target: { lat: STATION_LAT, lon: offsetEastKm(STATION_LAT, STATION_LON, 200) },
      conditions: { dk: 'manual', sfi: 120, kp: 2, t: Date.UTC(2026, 5, 21, 12, 0, 0) },
    },
  ),
  preset(
    'band-above-muf',
    'Band above its MUF',
    'V14 -- 10 m, 3000 km, SFI 70, night: escapes / Unlikely (above MUF)',
    {
      bandId: '10m',
      station: { qlat: STATION_LAT, qlon: STATION_LON },
      target: { lat: offsetNorthKm(STATION_LAT, -3000), lon: STATION_LON },
      conditions: { dk: 'manual', sfi: 70, kp: 2, t: Date.UTC(2026, 5, 21, 0, 0, 0) },
    },
  ),
  preset(
    'greyline-path',
    'Greyline path',
    'Invented for this phase -- not a physics-and-fidelity.md worked anchor. London-Tokyo, station-local sunset on a reference date, so the terminator visibly crosses the path.',
    {
      bandId: '20m',
      station: { qlat: 51.5074, qlon: -0.1278 }, // London
      target: { lat: 35.6895, lon: 139.6917 }, // Tokyo
      conditions: { dk: 'manual', sfi: 120, kp: 2, t: Date.UTC(2026, 2, 20, 18, 0, 0) }, // ~sunset at London on the 2026 equinox
    },
  ),
];
