// Live space weather from NOAA SWPC (F4.7) — a genuinely new integration
// for this app; no direct NOAA SWPC integration exists in Codeplug
// Studio to port from. Both endpoints are confirmed CORS-open
// (`access-control-allow-origin: *`, `cache-control: max-age=60`) and
// take no query parameters at all — no proxy needed, and no location
// data of any kind is sent with either request.

export interface SpaceWeatherReading {
  /** Plain SFI (10.7cm solar flux), NOT SSN. */
  sfi: number;
  /** Plain 0–9 Kp index, NOT NOAA's alphanumeric `kp` classification string. */
  kp: number;
  observedAtMs: number;
}

interface Flux2800Row {
  time_tag: string;
  frequency: number;
  flux: number;
}

interface KpRow {
  time_tag: string;
  kp_index: number;
}

const F107_FLUX_URL = 'https://services.swpc.noaa.gov/json/f107_cm_flux.json';
const PLANETARY_K_INDEX_URL = 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
const SOLAR_FLUX_FREQUENCY_MHZ = 2800;

/**
 * Fetches the latest SFI and Kp from NOAA SWPC.
 *
 * SFI is the `flux` field of the `frequency === 2800` (2800 MHz = 10.7cm
 * band) record with the latest `time_tag` — `f107_cm_flux.json` is one
 * entry per (frequency, reporting-schedule) combination, most-recent
 * `time_tag` first, but frequency is filtered explicitly rather than
 * assuming index 0 is the 2800 MHz record.
 *
 * Kp is the `kp_index` field (a plain integer 0–9) of the *last* element
 * of `planetary_k_index_1m.json` — that feed is ordered ascending by
 * `time_tag` (oldest first, the opposite order from the flux feed).
 * `estimated_kp` (a finer-grained nowcast float) and `kp` (NOAA's
 * alphanumeric classification, e.g. `"1M"`) are deliberately not used —
 * `kp_index` is the one whose units match every downstream consumer
 * (phase 2's `layerStates(sfi, kp, ...)`).
 */
export async function fetchLatestSpaceWeather(): Promise<SpaceWeatherReading> {
  const [fluxRes, kpRes] = await Promise.all([fetch(F107_FLUX_URL), fetch(PLANETARY_K_INDEX_URL)]);
  if (!fluxRes.ok || !kpRes.ok) throw new Error('NOAA SWPC fetch failed');

  const fluxRows = (await fluxRes.json()) as Flux2800Row[];
  const kpRows = (await kpRes.json()) as KpRow[];

  const flux2800 = fluxRows
    .filter((row) => row.frequency === SOLAR_FLUX_FREQUENCY_MHZ)
    .reduce<Flux2800Row | null>(
      (best, row) => (!best || row.time_tag > best.time_tag ? row : best),
      null,
    );
  const latestKp = kpRows.at(-1);

  if (!flux2800 || !latestKp) throw new Error('NOAA SWPC response missing expected fields');

  return { sfi: flux2800.flux, kp: latestKp.kp_index, observedAtMs: Date.now() };
}
