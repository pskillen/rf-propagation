import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEWER_URL_STATE } from '../types.ts';
import type { GlobeUrlState } from '../types.ts';
import { globeFieldCodec } from './globe.ts';

function encode(value: GlobeUrlState): URLSearchParams {
  const params = new URLSearchParams();
  globeFieldCodec.encode(value, params);
  return params;
}

function decode(params: URLSearchParams) {
  return globeFieldCodec.decode(params, DEFAULT_VIEWER_URL_STATE);
}

describe('globeFieldCodec', () => {
  it('round-trips every field when all are set', () => {
    const value: GlobeUrlState = {
      exaggerationFactor: 4.5,
      explodeEnabled: true,
      fresnelEnabled: false,
      terminatorEnabled: true,
      cutawayEnabled: true,
      mapMode: 'globe',
    };
    expect(decode(encode(value))).toEqual(value);
  });

  it('omits every param when no field is set, and decodes back to all-undefined (the "no override" state)', () => {
    const params = encode({});
    expect([...params.keys()]).toHaveLength(0);
    expect(decode(params)).toEqual({
      exaggerationFactor: undefined,
      explodeEnabled: undefined,
      fresnelEnabled: undefined,
      terminatorEnabled: undefined,
      cutawayEnabled: undefined,
      mapMode: undefined,
    });
  });

  it('booleans encode as 1/0, not true/false strings', () => {
    const params = encode({ explodeEnabled: true, fresnelEnabled: false });
    expect(params.get('ge')).toBe('1');
    expect(params.get('gf')).toBe('0');
  });

  it('an unknown mapMode value falls back to the default rather than throwing', () => {
    expect(() => decode(new URLSearchParams('gm=orbit'))).not.toThrow();
    expect(decode(new URLSearchParams('gm=orbit')).mapMode).toBeUndefined();
  });

  it('a non-numeric exaggerationFactor falls back to the default rather than NaN', () => {
    const result = decode(new URLSearchParams('gx=not-a-number'));
    expect(result.exaggerationFactor).toBeUndefined();
  });
});
