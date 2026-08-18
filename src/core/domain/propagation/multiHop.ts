/**
 * Multi-hop path solving for a KNOWN target ground distance (Path mode's
 * question, F2.11) -- the opposite direction from phase 3's
 * `computeLinkBudget`, which takes an already-known hop sequence. This
 * module searches: for a given distance and frequency, which hop count
 * (1-5) and which reflecting layer (E, F1, F2) gets a signal there at all,
 * and which combination is best?
 *
 * Equal hops (phase 2's `takeoffAngleForGroundRangeRad(D, n, h')` already
 * assumes this) is the standard simplifying assumption at this fidelity
 * tier -- see physics-and-fidelity.md §8.
 *
 * Ranking key: LOWEST TOTAL LOSS (fsplDb + absorptionDb + groundReflectionDb
 * + polarisationDb), equivalently HIGHEST snrDb2400 -- frequency,
 * noiseEnvironment and bandwidthHz are fixed inputs to this function, so
 * the noise floor is identical across every candidate, which makes "lowest
 * total loss" and "highest SNR" the same ordering. This function does NOT
 * rank by `reliability` (day-to-day MUF-spread x SNR-fading probability):
 * reliability's SNR term (`pSnr`) needs a per-MODE margin
 * (`modeMarginDb`/`reliability.ts`), and this function's signature (per the
 * phase plan) takes no `mode` parameter -- Station/Conditions and any mode
 * selector don't exist until phases 6-8. "Lowest total loss" is the
 * ranking key available from `LinkBudgetResult` alone, without inventing a
 * mode. Phase 13 (Path, the first UI consumer) gets the full
 * `LinkBudgetResult` back on `HopSolution.linkBudget` and can compute its
 * own mode-specific verdicts from `mufMhz`/`snrDb2400` via
 * `reliability.ts`'s `modeVerdict`. (Checked empirically for every scenario
 * this file's tests cover: "lowest total loss" and "highest SSB-reference
 * reliability" always pick the same (hopCount, layer) winner here, since
 * the two rankings only disagree when SNR headroom trades off against MUF
 * headroom in a way that flips the ordering, which doesn't occur across
 * these test scenarios.)
 *
 * DEVIATION FROM THE PHASE PLAN'S WORKED EXAMPLE (see multiHop.test.ts's
 * header for the full explanation, mirroring validation.test.ts's existing
 * V2/V4/Anchor-ratio/V18 deviation notes): phase 3's calibration anchors
 * hand-picked a takeoff angle and reflecting layer directly
 * (`buildAnchorHop` in validation.test.ts explicitly does NOT call
 * `selectReflectingLayer` -- Delta and the layer are GIVEN, not derived).
 * This function's job is exactly the validation phase 3 skipped: "confirm
 * the layer can actually reflect at that angle ... don't just assume the
 * requested layer holds" (this file's own phase-plan instruction). Running
 * that honest check against Anchor A/B's implied geometry shows E actually
 * intercepts and reflects 14MHz at the shallow angles a 1-hop-to-3360km or
 * 2-hop-to-5000km F2 path would need (E's own MUF, computed at THAT same
 * shallow launch angle over E's 110km virtual height, is comfortably above
 * 14MHz there -- this is the same large-secant-at-grazing-incidence
 * behaviour V2 already validates as a correct, intentional property of the
 * model, not a bug). Since E sits below F2 and is checked first
 * (reflection.ts's ascending-height candidate order), the wave never
 * reaches F2 at those particular 1-hop/2-hop geometries. The honestly-
 * validated search instead resolves 3360km to 2 F2 hops and 5000km to 3 F2
 * hops -- one hop more than each anchor's hand-picked figure, in both
 * cases. See this file's PR description for the full worked numbers.
 */

import { slantPathLengthKm, takeoffAngleForGroundRangeRad, groundRangePerHopKm } from './geometry';
import type { LayerId, LayerState } from './layers';
import type { GroundType } from './losses';
import type { NoiseEnvironment } from './noise';
import { selectReflectingLayer } from './reflection';
import { computeLinkBudget, type Hop, type LinkBudgetResult } from './linkBudget';

/** Hop counts tried, per F2.11's "evaluate hop counts 1-5" acceptance criterion. */
const MIN_HOP_COUNT = 1;
const MAX_HOP_COUNT = 5;

/** Candidate reflecting layers, in the order the wave would meet them (matches reflection.ts). */
const CANDIDATE_LAYER_IDS: readonly LayerId[] = ['E', 'F1', 'F2'];

export interface HopSolution {
  hopCount: number;
  layer: LayerId;
  hops: Hop[];
  linkBudget: LinkBudgetResult;
}

export type HopSolveResult = { kind: 'solved'; solution: HopSolution } | { kind: 'unreachable' };

export interface SolveHopsContext {
  ssn: number;
  groundType: GroundType;
  noiseEnvironment: NoiseEnvironment;
  txPowerW: number;
  txAntennaGainDbi: number;
  rxAntennaGainDbi: number;
  bandwidthHz: number;
  /** Solar zenith angle (deg) at the midpoint of hop `hopIndex` (0-based) of an `hopCount`-hop path. */
  solarZenithAtMidpointDeg: (hopIndex: number, hopCount: number) => number;
}

/** Total loss (dB) across every stage of the link budget -- this function's ranking key. */
function totalLossDb(result: LinkBudgetResult): number {
  return result.fsplDb + result.absorptionDb + result.groundReflectionDb + result.polarisationDb;
}

/**
 * Builds one candidate hop sequence for a given (hopCount, layer) pair, or
 * returns null if the geometry is infeasible (`takeoffAngleForGroundRangeRad`
 * returns a physically-invalid negative angle -- see V18's note in
 * validation.test.ts) or the candidate layer doesn't actually reflect at
 * that geometry (a candidate is invalid if the wave would reflect off a
 * DIFFERENT layer, or escape -- don't just assume the requested layer holds).
 */
function buildCandidate(
  groundRangeKm: number,
  hopCount: number,
  layerId: LayerId,
  frequencyMhz: number,
  layers: LayerState[],
  context: SolveHopsContext,
): Hop[] | null {
  const layerState = layers.find((candidate) => candidate.id === layerId);
  if (!layerState || layerState.criticalFrequencyMhz == null) return null;

  const takeoffAngleRad = takeoffAngleForGroundRangeRad(
    groundRangeKm,
    hopCount,
    layerState.virtualHeightKm,
  );
  if (!Number.isFinite(takeoffAngleRad) || takeoffAngleRad < 0) return null;

  const selection = selectReflectingLayer(frequencyMhz, takeoffAngleRad, layers);
  if (selection.kind !== 'reflected' || selection.layer !== layerId) return null;

  const groundRangePerHopKmValue = groundRangePerHopKm(takeoffAngleRad, layerState.virtualHeightKm);
  const slantPathKm = 2 * slantPathLengthKm(takeoffAngleRad, layerState.virtualHeightKm);

  return Array.from({ length: hopCount }, (_, hopIndex) => ({
    takeoffAngleRad,
    layer: layerId,
    virtualHeightKm: layerState.virtualHeightKm,
    groundRangeKm: groundRangePerHopKmValue,
    slantPathKm,
    solarZenithAtMidpointDeg: context.solarZenithAtMidpointDeg(hopIndex, hopCount),
    mufMhz: selection.mufMhz,
  }));
}

/**
 * Searches hop counts 1-5 across the E/F1/F2 candidate layers for the
 * lowest-total-loss valid path to `groundRangeKm` at `frequencyMhz`.
 * Distances beyond any achievable hop geometry return `{kind:
 * 'unreachable'}` rather than being silently clamped -- a direct ticket
 * acceptance criterion (mk1 had no concept of "too far").
 */
export function solveHopsForDistance(
  groundRangeKm: number,
  frequencyMhz: number,
  layers: LayerState[],
  context: SolveHopsContext,
): HopSolveResult {
  let best: HopSolution | null = null;
  let bestTotalLossDb = Infinity;

  for (let hopCount = MIN_HOP_COUNT; hopCount <= MAX_HOP_COUNT; hopCount++) {
    for (const layerId of CANDIDATE_LAYER_IDS) {
      const hops = buildCandidate(groundRangeKm, hopCount, layerId, frequencyMhz, layers, context);
      if (!hops) continue;

      const linkBudget = computeLinkBudget({
        hops,
        frequencyMhz,
        ssn: context.ssn,
        groundType: context.groundType,
        noiseEnvironment: context.noiseEnvironment,
        txPowerW: context.txPowerW,
        txAntennaGainDbi: context.txAntennaGainDbi,
        rxAntennaGainDbi: context.rxAntennaGainDbi,
        bandwidthHz: context.bandwidthHz,
      });

      const lossDb = totalLossDb(linkBudget);
      if (lossDb < bestTotalLossDb) {
        bestTotalLossDb = lossDb;
        best = { hopCount, layer: layerId, hops, linkBudget };
      }
    }
  }

  return best ? { kind: 'solved', solution: best } : { kind: 'unreachable' };
}
