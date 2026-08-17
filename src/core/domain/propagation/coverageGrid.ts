/**
 * Dense coverage grid (F2.12) -- the OPPOSITE direction from multiHop.ts's
 * Slice 1: instead of solving backward from a known distance, sweep
 * FORWARD over azimuth x elevation, tracing each ray through successive
 * hops, and bin every hop's landing point into a (azimuth, range) ground
 * cell. This is what makes the groundwave disc, the skip zone, and the
 * hop-1/hop-2/hop-3 landing bands fall out of the DATA rather than being
 * special-cased -- a cell with no hop landing in it anywhere in the sweep
 * IS the skip zone, by construction. This is a separate code path and a
 * separate resolution from the illustration rays (illustrationRays.ts) --
 * see that module's header for why the split matters.
 *
 * Per physics-and-fidelity.md §8: 72 azimuths (5deg steps, full 360deg) x
 * 90 elevations (1deg steps, 0-89deg) x up to 4 hops each.
 *
 * Simplification this sweep relies on (stated by the phase plan): "a hop's
 * takeoff angle stays constant at the launch elevation in this simplified
 * forward-sweep model" -- and `layers` (this grid's ionosphere) is ONE
 * evaluation at the station (physics-and-fidelity.md §7's "uniform
 * ionosphere" tier), not re-evaluated per hop. Given that, a ray that
 * reflects on its first hop reflects identically (same layer, same ground
 * range, same slant path) on every subsequent hop under this model --
 * `selectReflectingLayer` is still called once per hop (not hoisted out of
 * the loop) per the phase plan's literal instruction ("reflecting layer
 * chosen by selectReflectingLayer at each hop, same as any other hop"),
 * both to match that instruction and to keep this loop correct if a future
 * phase makes the per-hop layer state non-uniform. Only
 * `solarZenithAtMidpointDeg` varies per hop, because each hop's midpoint
 * is a different point on the Earth's surface (greatCircle.ts) -- this is
 * what actually produces greyline-like variation across the shaded grid.
 */

import { groundRangePerHopKm, slantPathLengthKm } from './geometry';
import { destinationPoint, type GeoPoint } from './greatCircle';
import type { GroundType } from './losses';
import type { LayerState } from './layers';
import { computeLinkBudget, type Hop } from './linkBudget';
import type { NoiseEnvironment } from './noise';
import { modeVerdict } from './reliability';
import { selectReflectingLayer } from './reflection';
import { solarZenithAngleDeg } from './solarZenithAngle';

const DEG_TO_RAD = Math.PI / 180;

export const COVERAGE_AZIMUTH_COUNT = 72; // 5deg steps, full 360deg
export const COVERAGE_ELEVATION_COUNT = 90; // 1deg steps, 0-89deg
export const COVERAGE_MAX_HOPS = 4;

/**
 * Range bin width (km) -- NOT specified numerically by
 * physics-and-fidelity.md (per the phase plan: "pick a resolution ... and
 * document it"). 50km is this phase's own reasonable call: fine enough to
 * resolve the skip-zone edge and individual hop bands, coarse enough that
 * the grid ({@link COVERAGE_RANGE_BIN_COUNT} x {@link COVERAGE_AZIMUTH_COUNT}
 * cells) stays small.
 */
export const COVERAGE_RANGE_BIN_KM = 50;

/**
 * Single-hop ground-range ceiling (km) used only to size the grid's range
 * axis -- matches V3's asserted cap (validation.test.ts), F2's own
 * geometric supremum at grazing incidence. `COVERAGE_MAX_HOPS` hops at
 * this ceiling is a generous (never physically reached in practice, since
 * grazing incidence every hop for 4 hops running is not realistic) upper
 * bound on how far a landing point can be from the station, so the grid
 * never truncates a real landing.
 */
const MAX_SINGLE_HOP_RANGE_KM = 4000;

export const COVERAGE_RANGE_BIN_COUNT = Math.ceil(
  (COVERAGE_MAX_HOPS * MAX_SINGLE_HOP_RANGE_KM) / COVERAGE_RANGE_BIN_KM,
);

/**
 * Groundwave range (km) judgment call -- FLAGGED EXPLICITLY, per the phase
 * plan: physics-and-fidelity.md gives no groundwave-range formula (only a
 * critique that mk1's fixed 300km was wrong by 10x). This is a simple,
 * clearly-labelled, UNCALIBRATED approximation providing the qualitative
 * direction the critique demands -- monotonically decreasing with
 * frequency, sea longest / land shortest / mixed between -- not a
 * calibrated model. Not covered by V1-V23 or the VOACAP goldens (all
 * skywave); nothing will catch a bad choice here except a human looking at
 * the picture in phase 8. TX power is deliberately NOT a factor here
 * (unlike real groundwave range, which does depend on power) -- kept
 * simple per the phase plan's own framing ("a simple ... approximation");
 * revisit if phase 8's rendering makes the omission look wrong.
 */
const GROUNDWAVE_BASE_RANGE_KM = 120; // reference range at 1MHz over "mixed" ground
const GROUNDWAVE_GROUND_FACTOR: Record<GroundType, number> = {
  sea: 1.6,
  mixed: 1.0,
  land: 0.5,
};
/** Reliability/SNR written into groundwave cells -- see {@link groundwaveRangeKm}'s doc. */
const GROUNDWAVE_RELIABILITY = 1;
const GROUNDWAVE_SNR_DB = 40;

function groundwaveRangeKm(frequencyMhz: number, groundType: GroundType): number {
  return (
    (GROUNDWAVE_BASE_RANGE_KM * GROUNDWAVE_GROUND_FACTOR[groundType]) / Math.sqrt(frequencyMhz)
  );
}

export interface CoverageGridInput {
  txLat: number;
  txLon: number;
  atMs: number;
  frequencyMhz: number;
  /**
   * ONE evaluation at the station (layerStates(sfi, kp,
   * solarZenithAngleDeg(txLat, txLon, atMs), geomagLatDeg)), consistent
   * with physics-and-fidelity.md §7's "uniform ionosphere" tier. See this
   * module's header for how per-hop spatial variation still enters via
   * solarZenithAtMidpointDeg.
   */
  layers: LayerState[];
  ssn: number;
  txPowerW: number;
  txAntennaGainDbi: number;
  rxAntennaGainDbi: number;
  groundType: GroundType;
  noiseEnvironment: NoiseEnvironment;
  bandwidthHz: number;
}

export interface CoverageGridResult {
  azimuthCount: number;
  rangeBinCount: number;
  rangeBinKm: number;
  /** [azimuth * rangeBinCount + rangeBin], 0..1, best reliability landing in that cell across all hops/elevations that reach it. */
  reliability: Float32Array;
  /** Same indexing as `reliability` -- SNR (dB, 2400Hz reference) at the best-reliability hop. */
  snrDb: Float32Array;
  /** Same indexing -- 0 = groundwave, 1..4 = hop number, 255 = no coverage (the skip zone). */
  hopCount: Uint8Array;
}

/** No-coverage sentinel -- see `CoverageGridResult.hopCount`'s doc. */
const NO_COVERAGE = 255;

/**
 * Reliability reference-mode judgment call -- FLAGGED EXPLICITLY, mirroring
 * the groundwave note above. `CoverageGridInput` has no `mode` field
 * (Station/Conditions and any mode selector don't exist until phases 6-8),
 * yet `CoverageGridResult.reliability` needs SOME margin term
 * (`reliability.ts`'s `pSnr` takes a mode-relative margin). This phase
 * reuses `modeVerdict` with SSB as an implicit reference mode -- the same
 * convention validation.test.ts's V16/V17 single-point checks already use
 * for "is this basically workable" spot checks. `snrDb` (the raw
 * `snrDb2400` value) is ALSO stored per cell, unconverted, so phase 8 can
 * layer its own mode-specific bucketing on top if/when a mode selector
 * exists, without needing to touch this grid's shape.
 */
const REFERENCE_MODE = 'ssb';

/**
 * Builds ONE hop's midpoint solar zenith angle: the geographic midpoint of
 * this hop (half its ground range past the previous hops' cumulative
 * range), projected from the station along `azimuthDeg` via great-circle
 * navigation, evaluated at `atMs`.
 */
function hopMidpointSolarZenithDeg(
  origin: GeoPoint,
  azimuthDeg: number,
  cumulativeGroundRangeKm: number,
  hopGroundRangeKm: number,
  atMs: number,
): number {
  const midpointRangeKm = cumulativeGroundRangeKm + hopGroundRangeKm / 2;
  const midpoint = destinationPoint(origin, azimuthDeg, midpointRangeKm);
  return solarZenithAngleDeg(midpoint.latDeg, midpoint.lonDeg, atMs);
}

/**
 * Traces the full sweep at reduced azimuth/elevation SAMPLE density
 * (`azimuthStride`/`elevationStride`), writing into a FULL-SIZE output grid
 * (`COVERAGE_AZIMUTH_COUNT` x `COVERAGE_RANGE_BIN_COUNT` always -- the
 * output shape never changes). A stride > 1 duplicate-fills the skipped
 * output azimuth slots with the nearest traced azimuth's result, so a
 * coarse pass has no untraced gaps -- just a blockier preview. This is
 * Worker plumbing for Slice 5's coarse-then-fine two-pass
 * (src/integrations/propagation); `computeCoverageGrid` below (stride 1,1)
 * is the ONLY entry point phase 8 depends on and its signature is
 * unchanged from the phase plan.
 *
 * `shouldCancel`, checked once per traced azimuth ROW (not every
 * iteration, not only at the end -- per the phase plan's own guidance for
 * Slice 5), lets an in-flight sweep stop early.
 */
export function computeCoverageGridAtStride(
  input: CoverageGridInput,
  azimuthStride: number,
  elevationStride: number,
  shouldCancel?: () => boolean,
): { kind: 'completed'; result: CoverageGridResult } | { kind: 'cancelled' } {
  const rangeBinCount = COVERAGE_RANGE_BIN_COUNT;
  const cellCount = COVERAGE_AZIMUTH_COUNT * rangeBinCount;

  const reliabilityArr = new Float32Array(cellCount);
  const snrDbArr = new Float32Array(cellCount);
  const hopCountArr = new Uint8Array(cellCount).fill(NO_COVERAGE);

  const groundwaveKm = groundwaveRangeKm(input.frequencyMhz, input.groundType);
  const groundwaveBinLimit = Math.min(
    rangeBinCount,
    Math.ceil(groundwaveKm / COVERAGE_RANGE_BIN_KM),
  );
  for (let az = 0; az < COVERAGE_AZIMUTH_COUNT; az++) {
    for (let bin = 0; bin < groundwaveBinLimit; bin++) {
      const idx = az * rangeBinCount + bin;
      reliabilityArr[idx] = GROUNDWAVE_RELIABILITY;
      snrDbArr[idx] = GROUNDWAVE_SNR_DB;
      hopCountArr[idx] = 0;
    }
  }

  const azimuthStepDeg = 360 / COVERAGE_AZIMUTH_COUNT;
  const origin: GeoPoint = { latDeg: input.txLat, lonDeg: input.txLon };

  // Reused across every (azimuth, elevation) trace -- avoids reallocating a
  // new array per iteration in the ~6,500-25,000-iteration hot loop. See
  // this module's header / PR description for the allocation trade-off
  // (Hop/LinkBudgetResult objects are still allocated per hop, reusing
  // phase 3's `computeLinkBudget` as the source of truth for correctness).
  const hops: Hop[] = [];

  for (let azIdx = 0; azIdx < COVERAGE_AZIMUTH_COUNT; azIdx += azimuthStride) {
    if (shouldCancel?.()) return { kind: 'cancelled' };

    const azimuthDeg = azIdx * azimuthStepDeg;
    const fillAzEnd = Math.min(azIdx + azimuthStride, COVERAGE_AZIMUTH_COUNT);

    for (let elIdx = 0; elIdx < COVERAGE_ELEVATION_COUNT; elIdx += elevationStride) {
      const elevationDeg = elIdx;
      const takeoffAngleRad = elevationDeg * DEG_TO_RAD;

      hops.length = 0;
      let cumulativeGroundRangeKm = 0;

      for (let hopIndex = 0; hopIndex < COVERAGE_MAX_HOPS; hopIndex++) {
        const reflection = selectReflectingLayer(input.frequencyMhz, takeoffAngleRad, input.layers);
        if (reflection.kind === 'escaped') break;

        const layerState = input.layers.find((l) => l.id === reflection.layer);
        if (!layerState) break; // defensive -- selectReflectingLayer only returns ids present in input.layers

        const groundRangeThisHopKm = groundRangePerHopKm(
          takeoffAngleRad,
          layerState.virtualHeightKm,
        );
        const slantPathKm = 2 * slantPathLengthKm(takeoffAngleRad, layerState.virtualHeightKm);
        const solarZenithAtMidpointDeg = hopMidpointSolarZenithDeg(
          origin,
          azimuthDeg,
          cumulativeGroundRangeKm,
          groundRangeThisHopKm,
          input.atMs,
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

        cumulativeGroundRangeKm += groundRangeThisHopKm;

        const linkBudget = computeLinkBudget({
          hops,
          frequencyMhz: input.frequencyMhz,
          txPowerW: input.txPowerW,
          txAntennaGainDbi: input.txAntennaGainDbi,
          rxAntennaGainDbi: input.rxAntennaGainDbi,
          groundType: input.groundType,
          noiseEnvironment: input.noiseEnvironment,
          ssn: input.ssn,
          bandwidthHz: input.bandwidthHz,
        });
        const verdict = modeVerdict(
          linkBudget.mufMhz,
          input.frequencyMhz,
          linkBudget.snrDb2400,
          REFERENCE_MODE,
        );

        const binIndex = Math.floor(cumulativeGroundRangeKm / COVERAGE_RANGE_BIN_KM);
        if (binIndex >= 0 && binIndex < rangeBinCount) {
          for (let fillAz = azIdx; fillAz < fillAzEnd; fillAz++) {
            const cellIdx = fillAz * rangeBinCount + binIndex;
            if (verdict.reliability > reliabilityArr[cellIdx]) {
              reliabilityArr[cellIdx] = verdict.reliability;
              snrDbArr[cellIdx] = linkBudget.snrDb2400;
              hopCountArr[cellIdx] = hopIndex + 1;
            }
          }
        }
      }
    }
  }

  return {
    kind: 'completed',
    result: {
      azimuthCount: COVERAGE_AZIMUTH_COUNT,
      rangeBinCount,
      rangeBinKm: COVERAGE_RANGE_BIN_KM,
      reliability: reliabilityArr,
      snrDb: snrDbArr,
      hopCount: hopCountArr,
    },
  };
}

/**
 * Full-resolution coverage grid sweep -- this is the ONLY entry point
 * phase 8 (Reach) and phase 8's Worker binding depend on; its signature
 * matches the phase plan exactly. See `computeCoverageGridAtStride` above
 * for the coarse-pass variant used internally by Slice 5's Worker.
 */
export function computeCoverageGrid(input: CoverageGridInput): CoverageGridResult {
  const swept = computeCoverageGridAtStride(input, 1, 1);
  // stride (1,1) with no shouldCancel never returns 'cancelled'.
  if (swept.kind === 'cancelled') {
    throw new Error(
      'unreachable: full-resolution sweep without a cancellation callback was cancelled',
    );
  }
  return swept.result;
}
