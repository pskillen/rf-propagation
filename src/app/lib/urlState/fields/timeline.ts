import type { UrlStateFieldCodec } from '../codec.ts';

function parseFiniteNumber(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Timeline's own reference distance/bearing URL codec (F11.1, phase 14) —
 * every field an optional override, same "absent means the app's own
 * current/default value" contract as every other field codec here.
 * `trk`/`trb` ("Timeline Reference Km"/"Timeline Reference Bearing") keep
 * a permalink with a custom reference set from growing much longer than
 * one without.
 */
export const timelineFieldCodec: UrlStateFieldCodec<'timeline'> = {
  key: 'timeline',
  encode(value, params) {
    if (value.referenceDistanceKm !== undefined) {
      params.set('trk', String(value.referenceDistanceKm));
    }
    if (value.referenceBearingDeg !== undefined) {
      params.set('trb', String(value.referenceBearingDeg));
    }
  },
  decode(params, defaults) {
    return {
      referenceDistanceKm:
        parseFiniteNumber(params.get('trk')) ?? defaults.timeline.referenceDistanceKm,
      referenceBearingDeg:
        parseFiniteNumber(params.get('trb')) ?? defaults.timeline.referenceBearingDeg,
    };
  },
};
