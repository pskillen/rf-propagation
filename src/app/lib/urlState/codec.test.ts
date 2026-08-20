import { describe, expect, it } from 'vitest';
import { decodeViewerUrlState, encodeViewerUrlState } from './codec.ts';
import {
  DEFAULT_BAND_ID,
  DEFAULT_VIEWER_URL_STATE,
  type SurfaceId,
  type ViewerUrlState,
} from './types.ts';

const ALL_SURFACES: readonly SurfaceId[] = ['reach', 'path', 'timeline', 'explore', 'compare'];

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

const EMPTY_EXPLORE: ViewerUrlState['explore'] = {
  radials: undefined,
  elevations: undefined,
  esMin: undefined,
  esMax: undefined,
  focusBearingDeg: undefined,
  outcomeFilter: undefined,
  colourBy: undefined,
  soloLayerId: undefined,
};

const EMPTY_COMPARE: ViewerUrlState['compare'] = {
  enabled: undefined,
  againstAntennaId: undefined,
  againstBandId: undefined,
  againstAtMs: undefined,
};

const EMPTY_TIMELINE: ViewerUrlState['timeline'] = {
  referenceDistanceKm: undefined,
  referenceBearingDeg: undefined,
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
      explore: {},
      compare: {},
      timeline: {},
    };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual({
      ...state,
      conditions: EMPTY_CONDITIONS,
      globe: EMPTY_GLOBE,
      playback: EMPTY_PLAYBACK,
      explore: EMPTY_EXPLORE,
      compare: EMPTY_COMPARE,
      timeline: EMPTY_TIMELINE,
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
      explore: EMPTY_EXPLORE,
      compare: EMPTY_COMPARE,
      timeline: EMPTY_TIMELINE,
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
      explore: {},
      compare: {},
      timeline: {},
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
      explore: {},
      compare: {},
      timeline: {},
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
      explore: {},
      compare: {},
      timeline: {},
    };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual({
      surface: 'explore',
      station: { qlat: undefined, qlon: undefined, ant: undefined, pwr: 400, noise: 'urban' },
      conditions: { t: undefined, dk: 'manual', sfi: 150, kp: 4, gnd: undefined },
      bandId: DEFAULT_BAND_ID,
      globe: EMPTY_GLOBE,
      playback: EMPTY_PLAYBACK,
      explore: EMPTY_EXPLORE,
      compare: EMPTY_COMPARE,
      timeline: EMPTY_TIMELINE,
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
      explore: {},
      compare: {},
      timeline: {},
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
      explore: EMPTY_EXPLORE,
      compare: EMPTY_COMPARE,
      timeline: EMPTY_TIMELINE,
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
      explore: {},
      compare: {},
      timeline: {},
    };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual({
      surface: 'reach',
      station: {},
      conditions: EMPTY_CONDITIONS,
      bandId: DEFAULT_BAND_ID,
      globe: EMPTY_GLOBE,
      playback: { unrealismUnlocked: true },
      explore: EMPTY_EXPLORE,
      compare: EMPTY_COMPARE,
      timeline: EMPTY_TIMELINE,
    });
  });

  it('a URL missing the playback param entirely (e.g. an older shared link) degrades to the default, not a throw', () => {
    expect(() => decodeViewerUrlState(new URLSearchParams('v=1&s=path'))).not.toThrow();
    const decoded = decodeViewerUrlState(new URLSearchParams('v=1&s=path'));
    expect(decoded.playback).toEqual(EMPTY_PLAYBACK);
  });

  it('round-trips an explore ray-controls override (phase 11, Slices 2-3) alongside other fields', () => {
    const state: ViewerUrlState = {
      surface: 'explore',
      station: {},
      conditions: {},
      bandId: DEFAULT_BAND_ID,
      globe: {},
      playback: {},
      explore: {
        radials: 12,
        elevations: 5,
        esMin: 2,
        esMax: 80,
        focusBearingDeg: 270,
        outcomeFilter: 'returned',
        colourBy: 'layer',
        soloLayerId: 'F2',
      },
      compare: {},
      timeline: {},
    };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual({
      surface: 'explore',
      station: {},
      conditions: EMPTY_CONDITIONS,
      bandId: DEFAULT_BAND_ID,
      globe: EMPTY_GLOBE,
      playback: EMPTY_PLAYBACK,
      explore: state.explore,
      compare: EMPTY_COMPARE,
      timeline: EMPTY_TIMELINE,
    });
  });

  it('a URL missing the explore param entirely degrades to the default, not a throw', () => {
    expect(() => decodeViewerUrlState(new URLSearchParams('v=1&s=path'))).not.toThrow();
    const decoded = decodeViewerUrlState(new URLSearchParams('v=1&s=path'));
    expect(decoded.explore).toEqual(EMPTY_EXPLORE);
  });

  it('round-trips a compare override (phase 12, Slice 1) alongside other fields', () => {
    const state: ViewerUrlState = {
      surface: 'compare',
      station: {},
      conditions: {},
      bandId: DEFAULT_BAND_ID,
      globe: {},
      playback: {},
      explore: {},
      compare: {
        enabled: true,
        againstAntennaId: 'ant-2',
        againstBandId: '20m',
        againstAtMs: 1_700_000_000_000,
      },
      timeline: {},
    };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual({
      surface: 'compare',
      station: {},
      conditions: EMPTY_CONDITIONS,
      bandId: DEFAULT_BAND_ID,
      globe: EMPTY_GLOBE,
      playback: EMPTY_PLAYBACK,
      explore: EMPTY_EXPLORE,
      compare: state.compare,
      timeline: EMPTY_TIMELINE,
    });
  });

  it('a URL missing the compare param entirely degrades to the default, not a throw', () => {
    expect(() => decodeViewerUrlState(new URLSearchParams('v=1&s=path'))).not.toThrow();
    const decoded = decodeViewerUrlState(new URLSearchParams('v=1&s=path'));
    expect(decoded.compare).toEqual(EMPTY_COMPARE);
  });

  it('round-trips a Timeline reference distance/bearing override (phase 14, F11.1) alongside other fields', () => {
    const state: ViewerUrlState = {
      surface: 'timeline',
      station: {},
      conditions: {},
      bandId: DEFAULT_BAND_ID,
      globe: {},
      playback: {},
      explore: {},
      compare: {},
      timeline: { referenceDistanceKm: 5000, referenceBearingDeg: 45 },
    };
    const roundTripped = decodeViewerUrlState(encodeViewerUrlState(state));
    expect(roundTripped).toEqual({
      surface: 'timeline',
      station: {},
      conditions: EMPTY_CONDITIONS,
      bandId: DEFAULT_BAND_ID,
      globe: EMPTY_GLOBE,
      playback: EMPTY_PLAYBACK,
      explore: EMPTY_EXPLORE,
      compare: EMPTY_COMPARE,
      timeline: state.timeline,
    });
  });

  it('a URL missing the timeline param entirely degrades to the default, not a throw', () => {
    expect(() => decodeViewerUrlState(new URLSearchParams('v=1&s=path'))).not.toThrow();
    const decoded = decodeViewerUrlState(new URLSearchParams('v=1&s=path'));
    expect(decoded.timeline).toEqual(EMPTY_TIMELINE);
  });
});
