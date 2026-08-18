/**
 * Illustration ray generator (F2.13) -- a small, OPERATOR-SIZED set of full
 * point-by-point polylines for rendering (up to 16 radials x up to 10
 * elevations), reusing the same per-hop physics as coverageGrid.ts's Slice
 * 2 but producing a renderable PATH rather than a binned cell.
 *
 * THE CRITICAL PROPERTY (F2.13's own acceptance criterion, and the
 * correction to mk1's tranche-2 planning per mk1-gap-analysis.md §3):
 * changing radialCount/elevationCount/elevationSpreadDeg must NEVER change
 * any value `computeCoverageGrid` produces. Rays illustrate the answer,
 * they do not compute it. This module enforces that BY CONSTRUCTION, not
 * by convention: it never imports `computeCoverageGrid`/
 * `computeCoverageGridAtStride`, holds no shared mutable state or cache
 * with coverageGrid.ts, and takes its own independent inputs. See
 * illustrationRays.test.ts's "coverage-grid independence" test for the
 * direct check (calls computeCoverageGrid, generates rays at two different
 * radial/elevation counts, calls computeCoverageGrid again, diffs the
 * typed arrays).
 *
 * Ray polyline altitude profile: NOT a solved refraction path (no such
 * formula exists in physics-and-fidelity.md) -- purely a half-sine curve
 * from ground to virtual height and back per hop, since the polyline
 * exists for RENDERING, not as an independent physics claim (the physics
 * -- reflecting layer, MUF, reliability -- is verified once, in
 * coverageGrid.ts/linkBudget.ts, and reused here unchanged).
 */

import { destinationPoint, type GeoPoint } from './greatCircle';
import { groundRangePerHopKm, slantPathLengthKm } from './geometry';
import type { LayerId } from './layers';
import { computeLinkBudget, type Hop } from './linkBudget';
import { COVERAGE_MAX_HOPS, type CoverageGridInput } from './coverageGrid';
import { selectReflectingLayer } from './reflection';
import { solarZenithAngleDeg } from './solarZenithAngle';

const DEG_TO_RAD = Math.PI / 180;

/** Points sampled along EACH LEG (ascending or descending) of a hop's arc, endpoints inclusive. */
const POINTS_PER_HOP_LEG = 6;

export interface RayPoint {
  /** Cumulative great-circle ground distance (km) from the station, along this ray's bearing. */
  distanceAlongBearingKm: number;
  altitudeKm: number;
  latDeg: number;
  lonDeg: number;
}

export type RayOutcome = 'escaped' | 'returned' | 'absorbed';

export interface IllustrationRay {
  azimuthDeg: number;
  elevationDeg: number;
  outcome: RayOutcome;
  /** One entry per hop actually traced (empty for 'escaped'). */
  reflectingLayers: LayerId[];
  points: RayPoint[];
}

export interface GenerateIllustrationRaysInput {
  /** <= 16 */
  radialCount: number;
  /** <= 10 */
  elevationCount: number;
  elevationSpreadDeg: [number, number];
  /** 'rose' tiles the full 360deg (Reach); 'fan' tiles a focused arc around a bearing (Path). */
  mode: 'rose' | 'fan';
  /** Required when mode === 'fan'. */
  focusBearingDeg?: number;
  /** Required when mode === 'fan'. */
  focusWidthDeg?: number;
}

/** A ray beyond this altitude (km) is considered to have left the model's frame of reference. */
const ESCAPE_ALTITUDE_KM = 1000;
/** How far along the escape ray's straight-line initial trajectory to draw it. */
const ESCAPE_DISTANCE_KM = 500;

function azimuthsForRose(radialCount: number): number[] {
  return Array.from({ length: radialCount }, (_, i) => (i * 360) / radialCount);
}

function azimuthsForFan(
  radialCount: number,
  focusBearingDeg: number,
  focusWidthDeg: number,
): number[] {
  if (radialCount === 1) return [focusBearingDeg];
  const start = focusBearingDeg - focusWidthDeg / 2;
  const step = focusWidthDeg / (radialCount - 1);
  return Array.from({ length: radialCount }, (_, i) => start + i * step);
}

function elevationsFor(elevationCount: number, spreadDeg: [number, number]): number[] {
  const [minDeg, maxDeg] = spreadDeg;
  if (elevationCount === 1) return [(minDeg + maxDeg) / 2];
  const step = (maxDeg - minDeg) / (elevationCount - 1);
  return Array.from({ length: elevationCount }, (_, i) => minDeg + i * step);
}

/** Points for one hop's up-leg + down-leg, given the hop's start distance/lat-lon-bearing context. */
function pointsForHop(
  origin: GeoPoint,
  azimuthDeg: number,
  startDistanceKm: number,
  hopGroundRangeKm: number,
  virtualHeightKm: number,
): RayPoint[] {
  const points: RayPoint[] = [];
  const halfHopKm = hopGroundRangeKm / 2;

  for (let i = 0; i <= POINTS_PER_HOP_LEG; i++) {
    const t = i / POINTS_PER_HOP_LEG;
    const distanceKm = startDistanceKm + t * halfHopKm;
    const altitudeKm = virtualHeightKm * Math.sin((t * Math.PI) / 2);
    const geo = destinationPoint(origin, azimuthDeg, distanceKm);
    points.push({
      distanceAlongBearingKm: distanceKm,
      altitudeKm,
      latDeg: geo.latDeg,
      lonDeg: geo.lonDeg,
    });
  }
  // Skip i=0 on the descending leg -- it's the same point as the ascending leg's last (the apex).
  for (let i = 1; i <= POINTS_PER_HOP_LEG; i++) {
    const t = i / POINTS_PER_HOP_LEG;
    const distanceKm = startDistanceKm + halfHopKm + t * halfHopKm;
    const altitudeKm = virtualHeightKm * Math.cos((t * Math.PI) / 2);
    const geo = destinationPoint(origin, azimuthDeg, distanceKm);
    points.push({
      distanceAlongBearingKm: distanceKm,
      altitudeKm,
      latDeg: geo.latDeg,
      lonDeg: geo.lonDeg,
    });
  }
  return points;
}

/**
 * Traces one ray (fixed azimuth + elevation) through up to
 * `COVERAGE_MAX_HOPS` hops, reusing the exact same per-hop physics as
 * coverageGrid.ts (selectReflectingLayer + computeLinkBudget), classifying
 * the outcome:
 *
 * - 'escaped': the wave never reflects at all (selectReflectingLayer
 *   returns 'escaped' on the first hop).
 * - 'absorbed': the wave DOES reflect and return to ground, but the
 *   cumulative link budget's SNR has dropped below the noise floor
 *   (snrDb2400 < 0) by that landing -- geometrically it came back, but the
 *   signal is gone. The trace stops at that hop (nothing further is drawn).
 * - 'returned': the wave reflects and stays above the noise floor for
 *   every hop it traces (up to COVERAGE_MAX_HOPS).
 *
 * This reuses `computeLinkBudget`'s real SNR output rather than inventing
 * a separate "absorption" heuristic -- a judgment call, since
 * physics-and-fidelity.md doesn't name an explicit escaped/returned/
 * absorbed classification rule.
 */
function traceRay(
  azimuthDeg: number,
  elevationDeg: number,
  context: CoverageGridInput,
): IllustrationRay {
  const origin: GeoPoint = { latDeg: context.txLat, lonDeg: context.txLon };
  const takeoffAngleRad = elevationDeg * DEG_TO_RAD;

  const firstReflection = selectReflectingLayer(
    context.frequencyMhz,
    takeoffAngleRad,
    context.layers,
  );
  if (firstReflection.kind === 'escaped') {
    // Not a solved trajectory (nothing to reflect off) -- a straight two-
    // point rendering hint from the station out to ESCAPE_DISTANCE_KM along
    // the launch bearing, rising to ESCAPE_ALTITUDE_KM.
    const groundPoint = destinationPoint(origin, azimuthDeg, 0);
    const escapePoint = destinationPoint(origin, azimuthDeg, ESCAPE_DISTANCE_KM);
    return {
      azimuthDeg,
      elevationDeg,
      outcome: 'escaped',
      reflectingLayers: [],
      points: [
        {
          distanceAlongBearingKm: 0,
          altitudeKm: 0,
          latDeg: groundPoint.latDeg,
          lonDeg: groundPoint.lonDeg,
        },
        {
          distanceAlongBearingKm: ESCAPE_DISTANCE_KM,
          altitudeKm: ESCAPE_ALTITUDE_KM,
          latDeg: escapePoint.latDeg,
          lonDeg: escapePoint.lonDeg,
        },
      ],
    };
  }

  const reflectingLayers: LayerId[] = [];
  const points: RayPoint[] = [];
  const hops: Hop[] = [];
  let cumulativeGroundRangeKm = 0;
  let outcome: RayOutcome = 'returned';

  for (let hopIndex = 0; hopIndex < COVERAGE_MAX_HOPS; hopIndex++) {
    const reflection = selectReflectingLayer(context.frequencyMhz, takeoffAngleRad, context.layers);
    if (reflection.kind === 'escaped') break;

    const layerState = context.layers.find((l) => l.id === reflection.layer);
    if (!layerState) break;

    const groundRangeThisHopKm = groundRangePerHopKm(takeoffAngleRad, layerState.virtualHeightKm);
    const slantPathKm = 2 * slantPathLengthKm(takeoffAngleRad, layerState.virtualHeightKm);
    const midpoint = destinationPoint(
      origin,
      azimuthDeg,
      cumulativeGroundRangeKm + groundRangeThisHopKm / 2,
    );
    const solarZenithAtMidpointDeg = solarZenithAngleDeg(
      midpoint.latDeg,
      midpoint.lonDeg,
      context.atMs,
    );

    hops.push({
      takeoffAngleRad,
      layer: reflection.layer,
      virtualHeightKm: layerState.virtualHeightKm,
      groundRangeKm: groundRangeThisHopKm,
      slantPathKm,
      solarZenithAtMidpointDeg,
      mufMhz: reflection.mufMhz,
    });
    reflectingLayers.push(reflection.layer);
    points.push(
      ...pointsForHop(
        origin,
        azimuthDeg,
        cumulativeGroundRangeKm,
        groundRangeThisHopKm,
        layerState.virtualHeightKm,
      ),
    );

    cumulativeGroundRangeKm += groundRangeThisHopKm;

    const linkBudget = computeLinkBudget({
      hops,
      frequencyMhz: context.frequencyMhz,
      txPowerW: context.txPowerW,
      txAntennaGainDbi: context.txAntennaGainDbi,
      rxAntennaGainDbi: context.rxAntennaGainDbi,
      groundType: context.groundType,
      noiseEnvironment: context.noiseEnvironment,
      ssn: context.ssn,
      bandwidthHz: context.bandwidthHz,
    });

    if (linkBudget.snrDb2400 < 0) {
      outcome = 'absorbed';
      break;
    }
  }

  return { azimuthDeg, elevationDeg, outcome, reflectingLayers, points };
}

/**
 * Generates up to `radialCount` x `elevationCount` illustration rays.
 * `context` is the same station/conditions shape Slice 2's
 * `CoverageGridInput` uses (frequency, layers, SSN, TX power/gain, ground
 * type, noise environment, bandwidth, station lat/lon/time) -- reused
 * directly per the phase plan's own suggestion, since both this function
 * and `computeCoverageGrid` need identical station/conditions context.
 */
export function generateIllustrationRays(
  input: GenerateIllustrationRaysInput,
  context: CoverageGridInput,
): IllustrationRay[] {
  const azimuths =
    input.mode === 'rose'
      ? azimuthsForRose(input.radialCount)
      : azimuthsForFan(input.radialCount, input.focusBearingDeg ?? 0, input.focusWidthDeg ?? 0);
  const elevations = elevationsFor(input.elevationCount, input.elevationSpreadDeg);

  const rays: IllustrationRay[] = [];
  for (const azimuthDeg of azimuths) {
    for (const elevationDeg of elevations) {
      rays.push(traceRay(azimuthDeg, elevationDeg, context));
    }
  }
  return rays;
}
