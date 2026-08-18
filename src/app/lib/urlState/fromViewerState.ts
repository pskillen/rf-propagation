/**
 * Full `ViewerState` -> `ViewerUrlState` mapping (F7.4, phase 10's Slice
 * 4) — what the "Share" permalink button actually encodes. Nothing else
 * in the repo builds this mapping: `ConditionsBar`'s own url-write effect
 * only ever writes `conditions`/`bandId` (the two fields it owns) into
 * whatever `ViewerUrlState` the router currently has, and no component
 * writes `station`/`target`/`display.globeToggles`/`playback` into the
 * URL live at all (Station persists to localStorage only; target/globe
 * toggles only ever write `ViewerState`, per phases 8/9's own PRs) — so
 * "the URL's current `ViewerUrlState`" was never a complete snapshot of
 * `ViewerState` to begin with. The permalink needs a COMPLETE one, built
 * fresh from `ViewerState` every time the Share button is pressed, not
 * whatever partial state happens to be sitting in the address bar.
 */
import type { Station } from '@core/domain/station/types';
import type { Conditions } from '@core/domain/conditions/types';
import type { ViewerState } from '../../state/viewerState.tsx';
import { DEFAULT_GLOBE_TOGGLES } from '../../state/globeToggles.ts';
import { DEFAULT_PLAYBACK } from '../../state/playback.ts';
import { DEFAULT_RAY_CONTROLS } from '../../state/rayControls.ts';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import type { ConditionsUrlState, StationUrlState, ViewerUrlState } from './types.ts';

const DEFAULT_ACTIVE_ANTENNA_FAMILY = DEFAULT_STATION.antennas.find(
  (antenna) => antenna.id === DEFAULT_STATION.activeAntennaId,
)?.family;

function stationToUrlState(station: Station): StationUrlState {
  const activeAntenna =
    station.antennas.find((antenna) => antenna.id === station.activeAntennaId) ??
    station.antennas[0];
  return {
    qlat: station.qth.lat !== DEFAULT_STATION.qth.lat ? station.qth.lat : undefined,
    qlon: station.qth.lon !== DEFAULT_STATION.qth.lon ? station.qth.lon : undefined,
    ant:
      activeAntenna?.family !== DEFAULT_ACTIVE_ANTENNA_FAMILY ? activeAntenna?.family : undefined,
    pwr: station.powerW !== DEFAULT_STATION.powerW ? station.powerW : undefined,
    noise:
      station.noiseEnvironment !== DEFAULT_STATION.noiseEnvironment
        ? station.noiseEnvironment
        : undefined,
  };
}

function conditionsToUrlState(conditions: Conditions): ConditionsUrlState {
  return {
    t: conditions.liveNow ? undefined : conditions.atMs,
    // A live snapshot isn't meaningful to encode -- same rule
    // `conditionsFieldCodec`'s own doc comment and `ConditionsBar`'s
    // url-write effect already follow.
    dk: conditions.driver.kind === 'live' ? undefined : conditions.driver.kind,
    sfi: conditions.driver.kind === 'live' ? undefined : conditions.driver.sfi,
    kp: conditions.driver.kind === 'live' ? undefined : conditions.driver.kp,
    // Unconditional, matching ConditionsBar's own url-write effect
    // exactly (`ground` has no "unset" state to omit for).
    gnd: conditions.ground,
  };
}

export function viewerStateToUrlState(state: ViewerState): ViewerUrlState {
  const globeToggles = state.display.globeToggles;
  return {
    surface: state.surface,
    station: stationToUrlState(state.station),
    conditions: conditionsToUrlState(state.conditions),
    bandId: state.bandId,
    target: state.target ? { lat: state.target.lat, lon: state.target.lon } : undefined,
    globe: {
      exaggerationFactor:
        globeToggles.exaggerationFactor !== DEFAULT_GLOBE_TOGGLES.exaggerationFactor
          ? globeToggles.exaggerationFactor
          : undefined,
      explodeEnabled:
        globeToggles.explodeEnabled !== DEFAULT_GLOBE_TOGGLES.explodeEnabled
          ? globeToggles.explodeEnabled
          : undefined,
      fresnelEnabled:
        globeToggles.fresnelEnabled !== DEFAULT_GLOBE_TOGGLES.fresnelEnabled
          ? globeToggles.fresnelEnabled
          : undefined,
      terminatorEnabled:
        globeToggles.terminatorEnabled !== DEFAULT_GLOBE_TOGGLES.terminatorEnabled
          ? globeToggles.terminatorEnabled
          : undefined,
      cutawayEnabled:
        globeToggles.cutawayEnabled !== DEFAULT_GLOBE_TOGGLES.cutawayEnabled
          ? globeToggles.cutawayEnabled
          : undefined,
      mapMode:
        globeToggles.mapMode !== DEFAULT_GLOBE_TOGGLES.mapMode ? globeToggles.mapMode : undefined,
    },
    playback: {
      unrealismUnlocked:
        state.playback.unrealismUnlocked !== DEFAULT_PLAYBACK.unrealismUnlocked
          ? state.playback.unrealismUnlocked
          : undefined,
    },
    explore: (() => {
      const rc = state.display.rayControls;
      return {
        radials: rc.radials !== DEFAULT_RAY_CONTROLS.radials ? rc.radials : undefined,
        elevations: rc.elevations !== DEFAULT_RAY_CONTROLS.elevations ? rc.elevations : undefined,
        esMin:
          rc.elevationSpreadDeg[0] !== DEFAULT_RAY_CONTROLS.elevationSpreadDeg[0]
            ? rc.elevationSpreadDeg[0]
            : undefined,
        esMax:
          rc.elevationSpreadDeg[1] !== DEFAULT_RAY_CONTROLS.elevationSpreadDeg[1]
            ? rc.elevationSpreadDeg[1]
            : undefined,
        focusBearingDeg:
          rc.focusBearingDeg !== DEFAULT_RAY_CONTROLS.focusBearingDeg
            ? rc.focusBearingDeg
            : undefined,
        outcomeFilter:
          rc.outcomeFilter !== DEFAULT_RAY_CONTROLS.outcomeFilter ? rc.outcomeFilter : undefined,
        colourBy: rc.colourBy !== DEFAULT_RAY_CONTROLS.colourBy ? rc.colourBy : undefined,
        soloLayerId: rc.soloLayerId,
      };
    })(),
  };
}
