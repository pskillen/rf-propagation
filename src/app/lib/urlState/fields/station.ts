import type { NoiseEnvironment } from '@core/domain/propagation/noise';
import type { UrlStateFieldCodec } from '../codec.ts';

const NOISE_ENVIRONMENTS: readonly NoiseEnvironment[] = [
  'urban',
  'residential',
  'rural',
  'quietRural',
];

function isNoiseEnvironment(value: string): value is NoiseEnvironment {
  return (NOISE_ENVIRONMENTS as readonly string[]).includes(value);
}

function parseFiniteNumber(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Lossy Station URL codec — round-trips QTH coordinates, the active
 * antenna's pattern family, power and noise environment (see
 * `StationUrlState` in `../types.ts` for why this is a deliberate subset,
 * not the full `Station`).
 *
 * **Judgment call, flagged:** every field here is an *override* — encode
 * omits a field precisely when it's `undefined` in the input (no override
 * present), and decode falls back to `defaults.station`'s corresponding
 * field (itself `undefined` for every field on `DEFAULT_VIEWER_URL_STATE`)
 * rather than to `DEFAULT_STATION`'s populated values. `encode()`'s own
 * signature (`(value, params)`, no `defaults` argument — see `codec.ts`)
 * has no way to compare against a populated default at all, and importing
 * `@core/domain/station/defaults.ts` here just to shorten the URL for the
 * common "unmodified default station" case would be doing more than this
 * phase's own acceptance criteria ask for ("this phase only needs the
 * registration mechanism and a reasonable field set to exist and
 * round-trip"). Revisit if phase 10's permalink feature (FR-35) finds the
 * unshortened default-station URL length insufficient.
 */
export const stationFieldCodec: UrlStateFieldCodec<'station'> = {
  key: 'station',
  encode(value, params) {
    if (value.qlat !== undefined) params.set('qlat', String(value.qlat));
    if (value.qlon !== undefined) params.set('qlon', String(value.qlon));
    if (value.ant !== undefined) params.set('ant', value.ant);
    if (value.pwr !== undefined) params.set('pwr', String(value.pwr));
    if (value.noise !== undefined) params.set('noise', value.noise);
  },
  decode(params, defaults) {
    const noiseRaw = params.get('noise');
    const pwrParsed = parseFiniteNumber(params.get('pwr'));
    const ant = params.get('ant');

    return {
      qlat: parseFiniteNumber(params.get('qlat')) ?? defaults.station.qlat,
      qlon: parseFiniteNumber(params.get('qlon')) ?? defaults.station.qlon,
      ant: ant ?? defaults.station.ant,
      pwr: pwrParsed !== undefined && pwrParsed > 0 ? pwrParsed : defaults.station.pwr,
      noise: noiseRaw && isNoiseEnvironment(noiseRaw) ? noiseRaw : defaults.station.noise,
    };
  },
};
