import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEWER_URL_STATE } from '../types.ts';
import type { TargetUrlState } from '../types.ts';
import { targetFieldCodec } from './target.ts';

function encode(value: TargetUrlState | undefined): URLSearchParams {
  const params = new URLSearchParams();
  targetFieldCodec.encode(value, params);
  return params;
}

function decode(params: URLSearchParams) {
  return targetFieldCodec.decode(params, DEFAULT_VIEWER_URL_STATE);
}

describe('targetFieldCodec', () => {
  it('round-trips a set target', () => {
    const value: TargetUrlState = { lat: 51.2, lon: -3.1 };
    expect(decode(encode(value))).toEqual(value);
  });

  it('omits both params when there is no target', () => {
    const params = encode(undefined);
    expect(params.has('tlat')).toBe(false);
    expect(params.has('tlon')).toBe(false);
  });

  it('decodes an empty URLSearchParams to no target (the default)', () => {
    expect(decode(new URLSearchParams())).toBeUndefined();
  });

  it('falls back to no target for a malformed or partial tlat/tlon pair, without throwing', () => {
    expect(() => decode(new URLSearchParams('tlat=not-a-number&tlon=-3.1'))).not.toThrow();
    expect(decode(new URLSearchParams('tlat=not-a-number&tlon=-3.1'))).toBeUndefined();
    expect(decode(new URLSearchParams('tlat=51.2'))).toBeUndefined(); // tlon missing
  });
});
