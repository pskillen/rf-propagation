import type { UrlStateFieldCodec } from '../codec.ts';

function parseFiniteNumber(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Target URL codec (F5.5, phase 8's Slice 5) — `tlat`/`tlon` only; see
 * `TargetUrlState`'s own doc comment in `../types.ts` for why `label`/
 * `source` don't round-trip. Present only when BOTH `tlat` and `tlon`
 * parse to finite numbers — a malformed or partial pair decodes to "no
 * target" rather than a half-populated one.
 */
export const targetFieldCodec: UrlStateFieldCodec<'target'> = {
  key: 'target',
  encode(value, params) {
    if (!value) return;
    params.set('tlat', String(value.lat));
    params.set('tlon', String(value.lon));
  },
  decode(params, defaults) {
    const lat = parseFiniteNumber(params.get('tlat'));
    const lon = parseFiniteNumber(params.get('tlon'));
    if (lat === undefined || lon === undefined) return defaults.target;
    return { lat, lon };
  },
};
