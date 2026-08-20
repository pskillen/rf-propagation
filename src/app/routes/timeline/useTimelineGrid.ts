/**
 * Assembles a `TimelineGridInput` from Station/Conditions/Target/Timeline
 * state and calls `computeTimelineGrid` (F11.1, [#73]) — the one place
 * Timeline turns "what the operator has configured" into "what the
 * engine needs," matching Reach's own `buildCoverageGridInput.ts` and
 * Path's own inline `solveContext` pattern.
 *
 * Runs synchronously on the main thread (no Worker) — see
 * `timelineGrid.ts`'s own doc comment for the "why" (this phase's plan
 * file's "Computation shape" section).
 *
 * Memoized on target/reference distance+bearing, station, and Conditions'
 * DATE component (year/month/day) plus the driver/ground fields the grid
 * actually reads — deliberately NOT on `conditions.atMs` itself, since
 * `atMs` ticks every ~1s while `liveNow` is true (`useConditions`) and the
 * grid only cares which UTC calendar day it's sweeping, not the live
 * clock's exact millisecond (see this phase's plan file's own "which day"
 * note). This is the "conditions excluding the swept hour" memoization
 * the plan file calls for.
 *
 * [#73]: https://github.com/pskillen/rf-propagation/issues/73
 */
import { useMemo } from 'react';
import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import { computeTimelineGrid, type TimelineCell } from '@core/domain/propagation/timelineGrid';
import { ssnFromSfi } from '@core/domain/propagation/losses';
import type { Station } from '@core/domain/station/types';
import type { Conditions } from '@core/domain/conditions/types';
import { approximateGeomagLatDeg } from '../../components/reach/buildCoverageGridInput.ts';
import { haversineDistanceKm, initialBearingDeg } from '../../lib/geo/bearingDistance.ts';
import type { Target } from '../../state/viewerState.tsx';
import type { TimelineState } from '../../state/timeline.ts';

/** The ten bands, each reduced to its own midpoint frequency — a stable, module-level reference (see this hook's doc comment). */
const TIMELINE_BANDS = UK_AMATEUR_BANDS.map((band) => ({
  id: band.id,
  frequencyMhz: (band.minMhz + band.maxMhz) / 2,
}));

export function useTimelineGrid(
  station: Station,
  conditions: Conditions,
  target: Target | null,
  timeline: TimelineState,
): TimelineCell[] {
  const activeAntenna =
    station.antennas.find((antenna) => antenna.id === station.activeAntennaId) ??
    station.antennas[0]!;

  const stationLat = station.qth.lat;
  const stationLon = station.qth.lon;

  const { distanceKm, bearingToTargetDeg } = useMemo(() => {
    if (target) {
      const origin = { latDeg: stationLat, lonDeg: stationLon };
      const destination = { latDeg: target.lat, lonDeg: target.lon };
      return {
        distanceKm: haversineDistanceKm(origin, destination),
        bearingToTargetDeg: initialBearingDeg(origin, destination),
      };
    }
    return {
      distanceKm: timeline.referenceDistanceKm,
      bearingToTargetDeg: timeline.referenceBearingDeg,
    };
  }, [target, stationLat, stationLon, timeline.referenceDistanceKm, timeline.referenceBearingDeg]);

  const atMsDate = new Date(conditions.atMs);
  const year = atMsDate.getUTCFullYear();
  const month = atMsDate.getUTCMonth() + 1;
  const day = atMsDate.getUTCDate();

  const { sfi, kp } = conditions.driver;
  const { ground } = conditions;
  const { noiseEnvironment, powerW } = station;

  return useMemo(
    () =>
      computeTimelineGrid({
        stationLatLon: [stationLat, stationLon],
        bearingToTargetDeg,
        distanceKm,
        dateUtc: { year, month, day },
        sfi,
        kp,
        geomagLatDeg: approximateGeomagLatDeg(stationLat, stationLon),
        ssn: ssnFromSfi(sfi),
        groundType: ground,
        noiseEnvironment,
        txPowerW: powerW,
        txAntennaGainDbi: activeAntenna.gainDbi,
        rxAntennaGainDbi: activeAntenna.gainDbi,
        bands: TIMELINE_BANDS,
      }),
    [
      stationLat,
      stationLon,
      bearingToTargetDeg,
      distanceKm,
      year,
      month,
      day,
      sfi,
      kp,
      ground,
      noiseEnvironment,
      powerW,
      activeAntenna,
    ],
  );
}
