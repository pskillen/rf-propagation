import { describe, expect, it } from 'vitest';
import { decodeViewerUrlState, encodeViewerUrlState } from './codec.ts';
import { DEFAULT_VIEWER_URL_STATE, type SurfaceId, type ViewerUrlState } from './types.ts';

const ALL_SURFACES: readonly SurfaceId[] = ['reach', 'path', 'timeline', 'explore'];

describe('viewer URL state codec', () => {
  it.each(ALL_SURFACES)('round-trips surface=%s', (surface) => {
    const state: ViewerUrlState = { surface, station: {} };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual(state);
  });

  it('degrades a bogus surface value and a future version to defaults', () => {
    const decoded = decodeViewerUrlState(new URLSearchParams('s=bogus&v=999'));
    expect(decoded).toEqual(DEFAULT_VIEWER_URL_STATE);
  });

  it('does not throw on malformed input', () => {
    expect(() => decodeViewerUrlState(new URLSearchParams('s=bogus&v=999'))).not.toThrow();
    expect(() => decodeViewerUrlState(new URLSearchParams('v=not-a-number'))).not.toThrow();
  });

  it('decodes a valid surface at or below the current version', () => {
    const decoded = decodeViewerUrlState(new URLSearchParams('v=1&s=path'));
    expect(decoded).toEqual({ surface: 'path', station: {} });
  });

  it('decodes an empty URLSearchParams to the default state', () => {
    const decoded = decodeViewerUrlState(new URLSearchParams());
    expect(decoded).toEqual(DEFAULT_VIEWER_URL_STATE);
  });

  it('omits the surface param when it is the default (reach), for a shorter URL', () => {
    const params = encodeViewerUrlState({ surface: 'reach', station: {} });
    expect(params.has('s')).toBe(false);
    expect(params.get('v')).toBe('1');
  });

  it('sets the surface param for a non-default surface', () => {
    const params = encodeViewerUrlState({ surface: 'timeline', station: {} });
    expect(params.get('s')).toBe('timeline');
  });

  it('round-trips a state with a station override alongside a non-default surface', () => {
    const state: ViewerUrlState = {
      surface: 'explore',
      station: { pwr: 400, noise: 'urban' },
    };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual({
      surface: 'explore',
      station: { qlat: undefined, qlon: undefined, ant: undefined, pwr: 400, noise: 'urban' },
    });
  });
});
