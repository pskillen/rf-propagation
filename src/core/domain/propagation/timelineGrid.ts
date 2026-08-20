/**
 * Timeline's 24-hour x band reliability grid (F11.1, [#73]) — "when should
 * I try?" for the operator's current Path target, or for a nominated
 * reference distance/bearing when no target is set (Reach mode). Pure
 * function, no React, no DOM — consistent with the `core` layer-boundary
 * rule (phase 1, AGENTS.md).
 *
 * Runs on the main thread synchronously, NOT through the coverage-grid
 * Worker — see this phase's plan file's "Computation shape" section:
 * ~3,600 `computeLinkBudget` evaluations at most (10 bands x 24 hours x up
 * to 5 hop counts x 3 candidate layers), roughly 5x smaller than the
 * coverage grid's own ~19,000-iteration sweep, which already fits a
 * ~150ms off-main-thread budget. `timelineGrid.test.ts`'s benchmark test
 * turns that reasoning into an enforced number.
 *
 * DEVIATION FROM THE PHASE PLAN'S LITERAL `TimelineGridInput` SNIPPET:
 * the plan sketched `targetLatLon`/`referenceDistanceKm`/`referenceBearingDeg`
 * alongside the already-resolved `distanceKm`/`bearingToTargetDeg` — but
 * resolving "target set -> great-circle distance/bearing from station,
 * else -> the reference distance/bearing" needs `@app/lib/geo/
 * bearingDistance.ts`'s inverse-geodesic helpers, which are app-layer-only
 * (core never imports app, and that module is deliberately NOT promoted
 * into core — see its own doc comment). `computeTimelineGrid` itself only
 * ever needs the ALREADY-RESOLVED `distanceKm`/`bearingToTargetDeg` (the
 * same "caller resolves target-or-reference into a bearing/range before
 * calling the engine" pattern `PathPage.tsx` already follows for the same
 * reason) — so this file's `TimelineGridInput` omits the three redundant
 * fields entirely rather than carrying them unused. Noted in this phase's
 * PR description as a deliberate simplification, not a drift from spec.
 */
import { destinationPoint, type GeoPoint } from './greatCircle';
import { layerStates } from './layers';
import { solarZenithAngleDeg } from './solarZenithAngle';
import { solveHopsForDistance, type HopSolveResult, type SolveHopsContext } from './multiHop';
import { modeVerdict, reliabilityBucket, type ReliabilityBucket } from './reliability';
import type { GroundType } from './losses';
import type { NoiseEnvironment } from './noise';

export const TIMELINE_HOURS_PER_DAY = 24;

export interface TimelineCell {
  bandId: string;
  /** Band midpoint MHz — the representative frequency this cell was evaluated at (see doc comment below). */
  frequencyMhz: number;
  /** 0-23, UTC. */
  hourUtc: number;
  hopSolve: HopSolveResult;
  /** SSB reliability (0..1) — see `computeTimelineGrid`'s own doc comment for why SSB, not best-of-three. */
  reliability: number;
  bucket: ReliabilityBucket;
}

export interface TimelineGridInput {
  /** Station's own location — also the origin for each hop's great-circle midpoint. */
  stationLatLon: [number, number];
  /** Bearing (degrees true) from station to target, or to the reference point when no target is set. */
  bearingToTargetDeg: number;
  /** Ground range (km) to target, or `timeline.referenceDistanceKm` when no target is set. */
  distanceKm: number;
  /** Which UTC calendar day's 24 hours to sweep — the date component of `conditions.atMs` (this phase's own call, see plan file). Month is 1-12. */
  dateUtc: { year: number; month: number; day: number };
  sfi: number;
  kp: number;
  geomagLatDeg: number;
  ssn: number;
  groundType: GroundType;
  noiseEnvironment: NoiseEnvironment;
  txPowerW: number;
  txAntennaGainDbi: number;
  rxAntennaGainDbi: number;
  /** The ten bands, each already reduced to one representative frequency (band midpoint — see doc comment below). */
  bands: { id: string; frequencyMhz: number }[];
}

/** Great-circle midpoint of hop `hopIndex` (0-based) of an `hopCount`-hop equal-hop path, at fractional distance `(hopIndex + 0.5) / hopCount` along the great circle. */
function hopMidpoint(
  origin: GeoPoint,
  bearingDeg: number,
  totalDistanceKm: number,
  hopIndex: number,
  hopCount: number,
): GeoPoint {
  const fractionalDistanceKm = (totalDistanceKm * (hopIndex + 0.5)) / hopCount;
  return destinationPoint(origin, bearingDeg, fractionalDistanceKm);
}

/**
 * Builds the 24-hour x band reliability grid — `input.bands.length * 24`
 * cells, one per (band, hour) pair, in band-then-hour order (band index
 * major, matching the plan file's own "10 rows (bands) x 24 columns
 * (hours)" grid layout).
 *
 * Representative frequency per band: each band's own midpoint (already
 * supplied on `input.bands`), NOT the operator's currently-selected exact
 * frequency — Timeline sweeps all ten bands independently of whatever
 * band is active elsewhere in the app. Judgment call, per this phase's
 * own plan file (no design doc specifies this rule).
 *
 * Reliability per cell: the SSB verdict's reliability, not the best of
 * SSB/CW/FT8 — the grid shows one number per cell, and SSB is the most
 * conservative/generally-useful reference mode. A future reader might
 * reasonably expect "best mode" instead; this is a deliberate pick, per
 * this phase's own plan file.
 */
export function computeTimelineGrid(input: TimelineGridInput): TimelineCell[] {
  const [stationLatDeg, stationLonDeg] = input.stationLatLon;
  const origin: GeoPoint = { latDeg: stationLatDeg, lonDeg: stationLonDeg };
  const cells: TimelineCell[] = [];

  for (const band of input.bands) {
    for (let hourUtc = 0; hourUtc < TIMELINE_HOURS_PER_DAY; hourUtc++) {
      const atMs = Date.UTC(
        input.dateUtc.year,
        input.dateUtc.month - 1,
        input.dateUtc.day,
        hourUtc,
      );

      // Layer state is evaluated at the STATION (same convention phases 2/3
      // established) -- the per-hop midpoint zenith below is a separate,
      // per-hop computation feeding solveHopsForDistance's own absorption/
      // foF2 evaluation at each hop's own geographic midpoint.
      const solarZenithAtStation = solarZenithAngleDeg(stationLatDeg, stationLonDeg, atMs);
      const layers = layerStates(input.sfi, input.kp, solarZenithAtStation, input.geomagLatDeg);

      const context: SolveHopsContext = {
        ssn: input.ssn,
        groundType: input.groundType,
        noiseEnvironment: input.noiseEnvironment,
        txPowerW: input.txPowerW,
        txAntennaGainDbi: input.txAntennaGainDbi,
        rxAntennaGainDbi: input.rxAntennaGainDbi,
        bandwidthHz: 2400,
        solarZenithAtMidpointDeg: (hopIndex, hopCount) => {
          const midpoint = hopMidpoint(
            origin,
            input.bearingToTargetDeg,
            input.distanceKm,
            hopIndex,
            hopCount,
          );
          return solarZenithAngleDeg(midpoint.latDeg, midpoint.lonDeg, atMs);
        },
      };

      const hopSolve = solveHopsForDistance(input.distanceKm, band.frequencyMhz, layers, context);

      if (hopSolve.kind === 'unreachable') {
        cells.push({
          bandId: band.id,
          frequencyMhz: band.frequencyMhz,
          hourUtc,
          hopSolve,
          reliability: 0,
          bucket: 'unlikely',
        });
        continue;
      }

      const ssbVerdict = modeVerdict(
        hopSolve.solution.linkBudget.mufMhz,
        band.frequencyMhz,
        hopSolve.solution.linkBudget.snrDb2400,
        'ssb',
      );
      cells.push({
        bandId: band.id,
        frequencyMhz: band.frequencyMhz,
        hourUtc,
        hopSolve,
        reliability: ssbVerdict.reliability,
        bucket: reliabilityBucket(ssbVerdict.reliability),
      });
    }
  }

  return cells;
}
