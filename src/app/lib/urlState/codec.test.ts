import { describe, expect, it } from 'vitest';
import { decodeViewerUrlState, encodeViewerUrlState } from './codec.ts';
import {
  DEFAULT_BAND_ID,
  DEFAULT_VIEWER_URL_STATE,
  type SurfaceId,
  type ViewerUrlState,
} from './types.ts';

const ALL_SURFACES: readonly SurfaceId[] = ['reach', 'path', 'timeline', 'explore'];

const EMPTY_CONDITIONS: ViewerUrlState['conditions'] = {
  t: undefined,
  dk: undefined,
  sfi: undefined,
  kp: undefined,
  gnd: undefined,
};

const EMPTY_GLOBE: ViewerUrlState['globe'] = {
  exaggerationFactor: undefined,
  explodeEnabled: undefined,
  fresnelEnabled: undefined,
  terminatorEnabled: undefined,
  cutawayEnabled: undefined,
  mapMode: undefined,
};

const EMPTY_PLAYBACK: ViewerUrlState['playback'] = {
  unrealismUnlocked: undefined,
};

describe('viewer URL state codec', () => {
  it.each(ALL_SURFACES)('round-trips surface=%s', (surface) => {
    const state: ViewerUrlState = {
      surface,
      station: {},
      conditions: {},
      bandId: DEFAULT_BAND_ID,
      globe: {},
      playback: {},
    };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual({
      ...state,
      conditions: EMPTY_CONDITIONS,
      globe: EMPTY_GLOBE,
      playback: EMPTY_PLAYBACK,
    });
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
    expect(decoded).toEqual({
      surface: 'path',
      station: {},
      conditions: EMPTY_CONDITIONS,
      bandId: DEFAULT_BAND_ID,
      globe: EMPTY_GLOBE,
      playback: EMPTY_PLAYBACK,
    });
  });

  it('decodes an empty URLSearchParams to the default state', () => {
    const decoded = decodeViewerUrlState(new URLSearchParams());
    expect(decoded).toEqual(DEFAULT_VIEWER_URL_STATE);
  });

  it('omits the surface param when it is the default (reach), for a shorter URL', () => {
    const params = encodeViewerUrlState({
      surface: 'reach',
      station: {},
      conditions: {},
      bandId: DEFAULT_BAND_ID,
      globe: {},
      playback: {},
    });
    expect(params.has('s')).toBe(false);
    expect(params.get('v')).toBe('1');
  });

  it('sets the surface param for a non-default surface', () => {
    const params = encodeViewerUrlState({
      surface: 'timeline',
      station: {},
      conditions: {},
      bandId: DEFAULT_BAND_ID,
      globe: {},
      playback: {},
    });
    expect(params.get('s')).toBe('timeline');
  });

  it('round-trips a state with a station and conditions override alongside a non-default surface', () => {
    const state: ViewerUrlState = {
      surface: 'explore',
      station: { pwr: 400, noise: 'urban' },
      conditions: { dk: 'manual', sfi: 150, kp: 4 },
      bandId: DEFAULT_BAND_ID,
      globe: {},
      playback: {},
    };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual({
      surface: 'explore',
      station: { qlat: undefined, qlon: undefined, ant: undefined, pwr: 400, noise: 'urban' },
      conditions: { t: undefined, dk: 'manual', sfi: 150, kp: 4, gnd: undefined },
      bandId: DEFAULT_BAND_ID,
      globe: EMPTY_GLOBE,
      playback: EMPTY_PLAYBACK,
    });
  });

  it('round-trips a globe-toggles override (phase 9, Slice 2) alongside other fields', () => {
    const state: ViewerUrlState = {
      surface: 'reach',
      station: {},
      conditions: {},
      bandId: DEFAULT_BAND_ID,
      globe: { exaggerationFactor: 3, mapMode: 'globe' },
      playback: {},
    };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual({
      surface: 'reach',
      station: {},
      conditions: EMPTY_CONDITIONS,
      bandId: DEFAULT_BAND_ID,
      globe: {
        ...EMPTY_GLOBE,
        exaggerationFactor: 3,
        mapMode: 'globe',
      },
      playback: EMPTY_PLAYBACK,
    });
  });

  it('round-trips a playback override (phase 10, Slice 4) alongside other fields', () => {
    const state: ViewerUrlState = {
      surface: 'reach',
      station: {},
      conditions: {},
      bandId: DEFAULT_BAND_ID,
      globe: {},
      playback: { unrealismUnlocked: true },
    };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual({
      surface: 'reach',
      station: {},
      conditions: EMPTY_CONDITIONS,
      bandId: DEFAULT_BAND_ID,
      globe: EMPTY_GLOBE,
      playback: { unrealismUnlocked: true },
    });
  });

  it('a URL missing the playback param entirely (e.g. an older shared link) degrades to the default, not a throw', () => {
    expect(() => decodeViewerUrlState(new URLSearchParams('v=1&s=path'))).not.toThrow();
    const decoded = decodeViewerUrlState(new URLSearchParams('v=1&s=path'));
    expect(decoded.playback).toEqual(EMPTY_PLAYBACK);
  });
});
