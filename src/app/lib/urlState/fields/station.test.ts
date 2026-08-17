import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEWER_URL_STATE } from '../types.ts';
import type { StationUrlState } from '../types.ts';
import { stationFieldCodec } from './station.ts';

function encode(value: StationUrlState): URLSearchParams {
  const params = new URLSearchParams();
  stationFieldCodec.encode(value, params);
  return params;
}

function decode(params: URLSearchParams) {
  return stationFieldCodec.decode(params, DEFAULT_VIEWER_URL_STATE);
}

describe('stationFieldCodec', () => {
  it('round-trips a fully-populated station override', () => {
    const value: StationUrlState = {
      qlat: 52.4862,
      qlon: -1.8904,
      ant: 'bidirectional-transverse',
      pwr: 100,
      noise: 'rural',
    };
    expect(decode(encode(value))).toEqual(value);
  });

  it('omits fields that are undefined in the input', () => {
    const params = encode({ pwr: 50 });
    expect(params.has('qlat')).toBe(false);
    expect(params.has('qlon')).toBe(false);
    expect(params.has('ant')).toBe(false);
    expect(params.has('noise')).toBe(false);
    expect(params.get('pwr')).toBe('50');
  });

  it('decodes an empty URLSearchParams to all-undefined (the default station override, i.e. none)', () => {
    expect(decode(new URLSearchParams())).toEqual({
      qlat: undefined,
      qlon: undefined,
      ant: undefined,
      pwr: undefined,
      noise: undefined,
    });
  });

  it('falls back to defaults for a malformed qlat/qlon/pwr without throwing', () => {
    const params = new URLSearchParams('qlat=not-a-number&qlon=NaN&pwr=-5');
    expect(() => decode(params)).not.toThrow();
    const decoded = decode(params);
    expect(decoded.qlat).toBeUndefined();
    expect(decoded.qlon).toBeUndefined();
    expect(decoded.pwr).toBeUndefined();
  });

  it('rejects an unknown noise environment literal and falls back to default', () => {
    const decoded = decode(new URLSearchParams('noise=suburban'));
    expect(decoded.noise).toBeUndefined();
  });

  it('accepts each valid NoiseEnvironment literal', () => {
    for (const noise of ['urban', 'residential', 'rural', 'quietRural'] as const) {
      expect(decode(new URLSearchParams(`noise=${noise}`)).noise).toBe(noise);
    }
  });

  it('round-trips a partial override, leaving unset fields undefined', () => {
    const value: StationUrlState = { pwr: 25 };
    expect(decode(encode(value))).toEqual({
      qlat: undefined,
      qlon: undefined,
      ant: undefined,
      pwr: 25,
      noise: undefined,
    });
  });
});
