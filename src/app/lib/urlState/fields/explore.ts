import type { UrlStateFieldCodec } from '../codec.ts';

const OUTCOME_FILTERS = ['all', 'escaped', 'returned', 'absorbed'] as const;
const COLOUR_BYS = ['mode', 'layer', 'signalStrength'] as const;
const LAYER_IDS = ['D', 'E', 'F1', 'F2'] as const;

function isOutcomeFilter(value: string): value is (typeof OUTCOME_FILTERS)[number] {
  return (OUTCOME_FILTERS as readonly string[]).includes(value);
}

function isColourBy(value: string): value is (typeof COLOUR_BYS)[number] {
  return (COLOUR_BYS as readonly string[]).includes(value);
}

function isLayerId(value: string): value is (typeof LAYER_IDS)[number] {
  return (LAYER_IDS as readonly string[]).includes(value);
}

function parseFiniteNumber(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Explore's ray-controls URL codec (F8.2/F8.3, phase 11's Slices 2-3) —
 * every field an optional override, same "absent means the app's own
 * current/default value" contract as `globeFieldCodec`. Short param names
 * (`rr`/`re`/`es0`/`es1`/`rb`/`of`/`cb`/`sl`) keep a permalink with every
 * ray control set from growing much longer than one with none.
 */
export const exploreFieldCodec: UrlStateFieldCodec<'explore'> = {
  key: 'explore',
  encode(value, params) {
    if (value.radials !== undefined) params.set('rr', String(value.radials));
    if (value.elevations !== undefined) params.set('re', String(value.elevations));
    if (value.esMin !== undefined) params.set('es0', String(value.esMin));
    if (value.esMax !== undefined) params.set('es1', String(value.esMax));
    if (value.focusBearingDeg !== undefined) params.set('rb', String(value.focusBearingDeg));
    if (value.outcomeFilter !== undefined) params.set('of', value.outcomeFilter);
    if (value.colourBy !== undefined) params.set('cb', value.colourBy);
    if (value.soloLayerId !== undefined) params.set('sl', value.soloLayerId);
  },
  decode(params, defaults) {
    const ofRaw = params.get('of');
    const cbRaw = params.get('cb');
    const slRaw = params.get('sl');
    return {
      radials: parseFiniteNumber(params.get('rr')) ?? defaults.explore.radials,
      elevations: parseFiniteNumber(params.get('re')) ?? defaults.explore.elevations,
      esMin: parseFiniteNumber(params.get('es0')) ?? defaults.explore.esMin,
      esMax: parseFiniteNumber(params.get('es1')) ?? defaults.explore.esMax,
      focusBearingDeg: parseFiniteNumber(params.get('rb')) ?? defaults.explore.focusBearingDeg,
      outcomeFilter: ofRaw && isOutcomeFilter(ofRaw) ? ofRaw : defaults.explore.outcomeFilter,
      colourBy: cbRaw && isColourBy(cbRaw) ? cbRaw : defaults.explore.colourBy,
      soloLayerId: slRaw && isLayerId(slRaw) ? slRaw : defaults.explore.soloLayerId,
    };
  },
};
