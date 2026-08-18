import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_VIEWER_URL_STATE } from '../types.ts';
import type { ConditionsUrlState } from '../types.ts';
import { conditionsFieldCodec, conditionsUrlStateToInitialTime } from './conditions.ts';

function encode(value: ConditionsUrlState): URLSearchParams {
  const params = new URLSearchParams();
  conditionsFieldCodec.encode(value, params);
  return params;
}

function decode(params: URLSearchParams) {
  return conditionsFieldCodec.decode(params, DEFAULT_VIEWER_URL_STATE);
}

describe('conditionsFieldCodec', () => {
  it('round-trips a non-live, manual-driver conditions object', () => {
    const value: ConditionsUrlState = {
      t: 1_723_896_000_000,
      dk: 'manual',
      sfi: 150,
      kp: 4,
      gnd: 'sea',
    };
    expect(decode(encode(value))).toEqual(value);
  });

  it('round-trips a preset-driver conditions object', () => {
    const value: ConditionsUrlState = {
      t: 1_723_896_000_000,
      dk: 'preset',
      sfi: 120,
      kp: 2,
      gnd: 'mixed',
    };
    expect(decode(encode(value))).toEqual(value);
  });

  it('omits fields that are undefined in the input', () => {
    const params = encode({ gnd: 'land' });
    expect(params.has('t')).toBe(false);
    expect(params.has('dk')).toBe(false);
    expect(params.has('sfi')).toBe(false);
    expect(params.has('kp')).toBe(false);
    expect(params.get('gnd')).toBe('land');
  });

  it('decodes an empty URLSearchParams to all-undefined (no override)', () => {
    expect(decode(new URLSearchParams())).toEqual({
      t: undefined,
      dk: undefined,
      sfi: undefined,
      kp: undefined,
      gnd: undefined,
    });
  });

  it('falls back to defaults for a malformed t/sfi/kp without throwing', () => {
    const params = new URLSearchParams('t=not-a-number&sfi=NaN&kp=banana');
    expect(() => decode(params)).not.toThrow();
    const decoded = decode(params);
    expect(decoded.t).toBeUndefined();
    expect(decoded.sfi).toBeUndefined();
    expect(decoded.kp).toBeUndefined();
  });

  it('rejects an unknown driver kind or ground type literal', () => {
    const decoded = decode(new URLSearchParams('dk=guessed&gnd=underwater'));
    expect(decoded.dk).toBeUndefined();
    expect(decoded.gnd).toBeUndefined();
  });
});

describe('conditionsUrlStateToInitialTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a URL with no t param decodes to liveNow: true with atMs near Date.now()', () => {
    const now = Date.parse('2026-08-17T12:00:00.000Z');
    vi.setSystemTime(now);

    const result = conditionsUrlStateToInitialTime({});

    expect(result.liveNow).toBe(true);
    expect(result.atMs).toBe(now);
  });

  it('a URL with a t param decodes to liveNow: false with atMs fixed at t', () => {
    const result = conditionsUrlStateToInitialTime({ t: 1_723_896_000_000 });

    expect(result.liveNow).toBe(false);
    expect(result.atMs).toBe(1_723_896_000_000);
  });
});
