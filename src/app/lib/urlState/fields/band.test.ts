import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEWER_URL_STATE } from '../types.ts';
import { bandFieldCodec } from './band.ts';

function encode(value: string): URLSearchParams {
  const params = new URLSearchParams();
  bandFieldCodec.encode(value, params);
  return params;
}

function decode(params: URLSearchParams) {
  return bandFieldCodec.decode(params, DEFAULT_VIEWER_URL_STATE);
}

describe('bandFieldCodec', () => {
  it('round-trips a known band id', () => {
    expect(decode(encode('20m'))).toBe('20m');
  });

  it('round-trips every catalogue band id', () => {
    for (const id of ['160m', '80m', '60m', '40m', '30m', '20m', '17m', '15m', '12m', '10m']) {
      expect(decode(encode(id))).toBe(id);
    }
  });

  it('decodes an empty URLSearchParams to the default band', () => {
    expect(decode(new URLSearchParams())).toBe(DEFAULT_VIEWER_URL_STATE.bandId);
  });

  it('decodes a malformed/unknown b param to the default band rather than throwing', () => {
    expect(() => decode(new URLSearchParams('b=not-a-band'))).not.toThrow();
    expect(decode(new URLSearchParams('b=not-a-band'))).toBe(DEFAULT_VIEWER_URL_STATE.bandId);
    expect(decode(new URLSearchParams('b=6m'))).toBe(DEFAULT_VIEWER_URL_STATE.bandId);
  });
});
