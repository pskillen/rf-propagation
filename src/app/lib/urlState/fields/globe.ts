import type { UrlStateFieldCodec } from '../codec.ts';

const MAP_MODES = ['map', 'globe'] as const;

function isMapMode(value: string): value is 'map' | 'globe' {
  return (MAP_MODES as readonly string[]).includes(value);
}

function parseFiniteNumber(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(raw: string | null): boolean | undefined {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return undefined;
}

/**
 * Globe Display-panel URL codec (F6.2, phase 9's Slice 2) — every field
 * an optional override, same "absent means the app's own current/default
 * value" contract as `stationFieldCodec`/`conditionsFieldCodec`. Short
 * param names (`gx`/`ge`/`gf`/`gt`/`gc`/`gm`) keep a permalink with every
 * globe toggle set from growing much longer than one with none.
 */
export const globeFieldCodec: UrlStateFieldCodec<'globe'> = {
  key: 'globe',
  encode(value, params) {
    if (value.exaggerationFactor !== undefined) {
      params.set('gx', String(value.exaggerationFactor));
    }
    if (value.explodeEnabled !== undefined) params.set('ge', value.explodeEnabled ? '1' : '0');
    if (value.fresnelEnabled !== undefined) params.set('gf', value.fresnelEnabled ? '1' : '0');
    if (value.terminatorEnabled !== undefined) {
      params.set('gt', value.terminatorEnabled ? '1' : '0');
    }
    if (value.cutawayEnabled !== undefined) params.set('gc', value.cutawayEnabled ? '1' : '0');
    if (value.mapMode !== undefined) params.set('gm', value.mapMode);
  },
  decode(params, defaults) {
    const gmRaw = params.get('gm');
    return {
      exaggerationFactor: parseFiniteNumber(params.get('gx')) ?? defaults.globe.exaggerationFactor,
      explodeEnabled: parseBoolean(params.get('ge')) ?? defaults.globe.explodeEnabled,
      fresnelEnabled: parseBoolean(params.get('gf')) ?? defaults.globe.fresnelEnabled,
      terminatorEnabled: parseBoolean(params.get('gt')) ?? defaults.globe.terminatorEnabled,
      cutawayEnabled: parseBoolean(params.get('gc')) ?? defaults.globe.cutawayEnabled,
      mapMode: gmRaw && isMapMode(gmRaw) ? gmRaw : defaults.globe.mapMode,
    };
  },
};
