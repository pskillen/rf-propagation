import { describe, expect, it } from 'vitest';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import { DEFAULT_GLOBE_TOGGLES } from '../../state/globeToggles.ts';
import { DEFAULT_PLAYBACK } from '../../state/playback.ts';
import { DEFAULT_RAY_CONTROLS } from '../../state/rayControls.ts';
import { DEFAULT_COMPARE_STATE } from '@core/domain/propagation/compareScenario';
import type { ViewerState } from '../../state/viewerState.tsx';
import { encodeViewerUrlState } from './codec.ts';
import { viewerStateToUrlState } from './fromViewerState.ts';

function baseViewerState(): ViewerState {
  return {
    surface: 'reach',
    station: DEFAULT_STATION,
    conditions: DEFAULT_CONDITIONS,
    bandId: '40m',
    frequencyMhz: 7.1,
    target: null,
    display: { globeToggles: DEFAULT_GLOBE_TOGGLES, rayControls: DEFAULT_RAY_CONTROLS },
    playback: DEFAULT_PLAYBACK,
    compare: DEFAULT_COMPARE_STATE,
  };
}

describe('viewerStateToUrlState', () => {
  it('an unmodified default ViewerState omits station/globe/playback overrides', () => {
    const params = encodeViewerUrlState(viewerStateToUrlState(baseViewerState()));
    // `dk`/`sfi`/`kp` still appear -- DEFAULT_CONDITIONS's own driver is
    // `'preset'`, not `'live'` (the fallback chain's baked-in starting
    // value before any live fetch resolves), and `ConditionsUrlState`'s
    // own "encode whenever not live" rule (see `conditionsFieldCodec`'s
    // doc comment) applies here exactly as it does to ConditionsBar's own
    // url-write effect -- this is a faithful encoding of the true
    // current state, not a bug. Station/target/globe/playback DO all
    // stay at their real defaults here, so none of THEIR fields appear.
    expect([...params.keys()].sort()).toEqual(['b', 'dk', 'gnd', 'kp', 'sfi', 'v']);
  });

  it('encodes a non-default station (QTH, power, noise, active antenna family)', () => {
    const state = baseViewerState();
    state.station = {
      ...DEFAULT_STATION,
      qth: { ...DEFAULT_STATION.qth, lat: 51.5, lon: -0.1 },
      powerW: 400,
      noiseEnvironment: 'urban',
    };
    const params = encodeViewerUrlState(viewerStateToUrlState(state));
    expect(params.get('qlat')).toBe('51.5');
    expect(params.get('qlon')).toBe('-0.1');
    expect(params.get('pwr')).toBe('400');
    expect(params.get('noise')).toBe('urban');
    // Family is unchanged from the default station's own active antenna
    // -- omitted, not redundantly encoded.
    expect(params.get('ant')).toBeNull();
  });

  it('encodes the active antenna family only when it differs from the default', () => {
    const state = baseViewerState();
    state.station = {
      ...DEFAULT_STATION,
      antennas: [
        ...DEFAULT_STATION.antennas,
        {
          id: 'vertical-1',
          name: 'Vertical',
          family: 'omnidirectional-vertical',
          heightM: 5,
          gainDbi: 0,
        },
      ],
      activeAntennaId: 'vertical-1',
    };
    const params = encodeViewerUrlState(viewerStateToUrlState(state));
    expect(params.get('ant')).toBe('omnidirectional-vertical');
  });

  it('encodes a non-live Conditions snapshot and a manual driver', () => {
    const state = baseViewerState();
    state.conditions = {
      atMs: 1_700_000_000_000,
      liveNow: false,
      driver: { kind: 'manual', sfi: 200, kp: 6 },
      ground: 'sea',
    };
    const params = encodeViewerUrlState(viewerStateToUrlState(state));
    expect(params.get('t')).toBe('1700000000000');
    expect(params.get('dk')).toBe('manual');
    expect(params.get('sfi')).toBe('200');
    expect(params.get('kp')).toBe('6');
    expect(params.get('gnd')).toBe('sea');
  });

  it('encodes a target and non-default globe toggles', () => {
    const state = baseViewerState();
    state.target = { lat: 40, lon: 10, source: 'map-click' };
    state.display = {
      globeToggles: { ...DEFAULT_GLOBE_TOGGLES, mapMode: 'globe', exaggerationFactor: 6 },
      rayControls: DEFAULT_RAY_CONTROLS,
    };
    const params = encodeViewerUrlState(viewerStateToUrlState(state));
    expect(params.get('tlat')).toBe('40');
    expect(params.get('tlon')).toBe('10');
    expect(params.get('gm')).toBe('globe');
    expect(params.get('gx')).toBe('6');
  });

  it('encodes unrealismUnlocked only when true', () => {
    const state = baseViewerState();
    state.playback = { ...DEFAULT_PLAYBACK, unrealismUnlocked: true };
    const params = encodeViewerUrlState(viewerStateToUrlState(state));
    expect(params.get('ru')).toBe('1');
  });
});
