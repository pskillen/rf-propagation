/**
 * Per-ray link budget for illustration rays (F8.3, phase 11's Slice 3) --
 * "colour by signal strength" needs an SNR per `IllustrationRay`, which
 * the type itself doesn't carry (`{azimuthDeg, elevationDeg, outcome,
 * reflectingLayers, points}` — no SNR field, phase 4's own shape). This
 * is display-only enrichment, not a new physics claim: it calls the same
 * pure engine functions `illustrationRays.ts`'s own `traceRay` already
 * calls internally (`selectReflectingLayer`, `groundRangePerHopKm`,
 * `slantPathLengthKm`, `computeLinkBudget`), reconstructing each hop from
 * the ray's own `reflectingLayers` + a fixed takeoff angle
 * (`ray.elevationDeg`) rather than inventing a second physics path.
 *
 * Deliberately NOT added as a field on `IllustrationRay` itself
 * (see this phase's own "Out of scope" note) — reshaping phase 4's
 * already cross-phase-load-bearing type is a separate call, not this
 * phase's to make unilaterally.
 */
import { elevationGainDbi } from '../antenna/antennaPattern';
import { destinationPoint, type GeoPoint } from './greatCircle';
import { groundRangePerHopKm, slantPathLengthKm } from './geometry';
import type { CoverageGridInput } from './coverageGrid';
import type { IllustrationRay } from './illustrationRays';
import { computeLinkBudget, type Hop, type LinkBudgetResult } from './linkBudget';
import { selectReflectingLayer } from './reflection';
import { solarZenithAngleDeg } from './solarZenithAngle';

const DEG_TO_RAD = Math.PI / 180;

/**
 * `null` for `'escaped'`/`'absorbed'`-with-no-reflection rays — there is
 * no complete ground-to-ground budget to report for a ray that never came
 * back down. Uses the SAME `context` shape `generateIllustrationRays`
 * itself takes (`CoverageGridInput`), since both need identical station/
 * conditions/layers/antenna inputs to reproduce the exact geometry the
 * ray was originally traced with.
 */
export function computeIllustrationRayBudget(
  ray: IllustrationRay,
  context: CoverageGridInput,
): LinkBudgetResult | null {
  if (ray.reflectingLayers.length === 0) return null;

  const origin: GeoPoint = { latDeg: context.txLat, lonDeg: context.txLon };
  const takeoffAngleRad = ray.elevationDeg * DEG_TO_RAD;
  const hops: Hop[] = [];
  let cumulativeGroundRangeKm = 0;

  for (const layerId of ray.reflectingLayers) {
    const layerState = context.layers.find((l) => l.id === layerId);
    if (!layerState) return null;

    const groundRangeThisHopKm = groundRangePerHopKm(takeoffAngleRad, layerState.virtualHeightKm);
    const slantPathKm = 2 * slantPathLengthKm(takeoffAngleRad, layerState.virtualHeightKm);
    const midpoint = destinationPoint(
      origin,
      ray.azimuthDeg,
      cumulativeGroundRangeKm + groundRangeThisHopKm / 2,
    );
    const solarZenithAtMidpointDeg = solarZenithAngleDeg(
      midpoint.latDeg,
      midpoint.lonDeg,
      context.atMs,
    );
    const selection = selectReflectingLayer(context.frequencyMhz, takeoffAngleRad, context.layers);
    const mufMhz = selection.kind === 'reflected' ? selection.mufMhz : 0;

    hops.push({
      takeoffAngleRad,
      layer: layerId,
      virtualHeightKm: layerState.virtualHeightKm,
      groundRangeKm: groundRangeThisHopKm,
      slantPathKm,
      solarZenithAtMidpointDeg,
      mufMhz,
    });
    cumulativeGroundRangeKm += groundRangeThisHopKm;
  }

  return computeLinkBudget({
    hops,
    frequencyMhz: context.frequencyMhz,
    txPowerW: context.txPowerW,
    txAntennaGainDbi: elevationGainDbi(
      context.txAntenna,
      ray.elevationDeg,
      ray.azimuthDeg,
      context.frequencyMhz,
    ),
    rxAntennaGainDbi: context.rxAntennaGainDbi,
    groundType: context.groundType,
    noiseEnvironment: context.noiseEnvironment,
    ssn: context.ssn,
    bandwidthHz: context.bandwidthHz,
  });
}
