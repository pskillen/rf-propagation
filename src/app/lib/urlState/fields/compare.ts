import type { UrlStateFieldCodec } from '../codec.ts';

function parseBoolean(raw: string | null): boolean | undefined {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return undefined;
}

function parseFiniteNumber(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Compare's URL codec (F9, phase 12) — every field an optional override,
 * same "absent means the app's own current/default value" contract as
 * every other field codec here. Short param names (`cmp`/`cant`/`cband`/
 * `cat`) keep a permalink with a comparison active from growing much
 * longer than one without. This is the last field the URL codec's own
 * doc ([url-state-codec.md](../../../../docs/features/app-shell/url-state-codec.md))
 * flagged as "not yet registered" — see that doc's updated "Fields so
 * far" table.
 */
export const compareFieldCodec: UrlStateFieldCodec<'compare'> = {
  key: 'compare',
  encode(value, params) {
    if (value.enabled !== undefined) params.set('cmp', value.enabled ? '1' : '0');
    if (value.againstAntennaId !== undefined) params.set('cant', value.againstAntennaId);
    if (value.againstBandId !== undefined) params.set('cband', value.againstBandId);
    if (value.againstAtMs !== undefined) params.set('cat', String(value.againstAtMs));
  },
  decode(params, defaults) {
    const cant = params.get('cant');
    const cband = params.get('cband');
    return {
      enabled: parseBoolean(params.get('cmp')) ?? defaults.compare.enabled,
      againstAntennaId: cant ?? defaults.compare.againstAntennaId,
      againstBandId: cband ?? defaults.compare.againstBandId,
      againstAtMs: parseFiniteNumber(params.get('cat')) ?? defaults.compare.againstAtMs,
    };
  },
};
