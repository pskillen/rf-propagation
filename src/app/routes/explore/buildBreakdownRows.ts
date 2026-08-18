/**
 * "Explain this" link-budget breakdown data assembly (F8.5, phase 11's
 * Slice 5) — turns a `HopSolution` (`solveHopsForDistance`) into a
 * per-hop, per-loss-type breakdown that reconciles exactly to
 * `LinkBudgetResult`'s own totals. App-layer: it calls existing pure
 * engine functions for display purposes (per-hop absorption, per-bounce
 * ground reflection — both direct F8.5 acceptance criteria, and neither
 * carried on `LinkBudgetResult` itself, which only has the pre-summed
 * totals), it does not add a new formula. If a number here doesn't
 * reconcile against `LinkBudgetResult`, that's a bug in this file, not a
 * new physical claim to invent.
 */
import { incidenceAngleRad } from '@core/domain/propagation/geometry';
import {
  groundReflectionLossDb,
  ionosphericAbsorptionDbPerHop,
  type GroundType,
} from '@core/domain/propagation/losses';
import type { LayerId } from '@core/domain/propagation/layers';
import type { Hop, LinkBudgetResult } from '@core/domain/propagation/linkBudget';
import type { HopSolution } from '@core/domain/propagation/multiHop';
import { modeVerdict, type ModeVerdict } from '@core/domain/propagation/reliability';
import type { Mode } from '@core/domain/propagation/modes';

/** D-region absorbing-region height (km) — matches linkBudget.ts's own internal constant exactly (load-bearing for reconciliation). */
const D_LAYER_HEIGHT_KM = 90;
const RAD_TO_DEG = 180 / Math.PI;

export interface HopAbsorptionRow {
  hopIndex: number;
  layer: LayerId;
  takeoffAngleDeg: number;
  absorptionDb: number;
}

export interface GroundBounceRow {
  bounceIndex: number;
  lossDb: number;
}

export interface LinkBudgetBreakdown {
  hopCount: number;
  reflectingLayers: LayerId[];
  takeoffAngleDeg: number;
  eirpDbm: number;
  fsplDb: number;
  perHopAbsorption: HopAbsorptionRow[];
  totalAbsorptionDb: number;
  perBounceGroundReflection: GroundBounceRow[];
  totalGroundReflectionDb: number;
  polarisationDb: number;
  receivedPowerDbm: number;
  noiseFloorDbm: number;
  snrDb2400: number;
  mufMhz: number;
  modeVerdicts: ModeVerdict[];
}

const BREAKDOWN_MODES: readonly Mode[] = ['ssb', 'cw', 'ft8'];

function perHopAbsorptionRow(
  hop: Hop,
  index: number,
  ssn: number,
  frequencyMhz: number,
): HopAbsorptionRow {
  const incidenceAngleAtDLayerRad = incidenceAngleRad(hop.takeoffAngleRad, D_LAYER_HEIGHT_KM);
  const absorptionDb = ionosphericAbsorptionDbPerHop(
    incidenceAngleAtDLayerRad,
    ssn,
    hop.solarZenithAtMidpointDeg,
    frequencyMhz,
  );
  return {
    hopIndex: index,
    layer: hop.layer,
    takeoffAngleDeg: hop.takeoffAngleRad * RAD_TO_DEG,
    absorptionDb,
  };
}

export function buildLinkBudgetBreakdown(
  solution: HopSolution,
  context: { frequencyMhz: number; ssn: number; groundType: GroundType },
): LinkBudgetBreakdown {
  const {
    hops,
    linkBudget,
    hopCount,
  }: { hops: Hop[]; linkBudget: LinkBudgetResult; hopCount: number } = solution;

  const perHopAbsorption = hops.map((hop, i) =>
    perHopAbsorptionRow(hop, i, context.ssn, context.frequencyMhz),
  );
  const totalAbsorptionDb = perHopAbsorption.reduce((sum, row) => sum + row.absorptionDb, 0);

  const bounceCount = Math.max(0, hops.length - 1);
  const perBounceGroundReflection: GroundBounceRow[] = Array.from(
    { length: bounceCount },
    (_, i) => ({ bounceIndex: i, lossDb: groundReflectionLossDb(context.groundType, 1) }),
  );
  const totalGroundReflectionDb = perBounceGroundReflection.reduce(
    (sum, row) => sum + row.lossDb,
    0,
  );

  const modeVerdicts = BREAKDOWN_MODES.map((mode) =>
    modeVerdict(linkBudget.mufMhz, context.frequencyMhz, linkBudget.snrDb2400, mode),
  );

  return {
    hopCount,
    reflectingLayers: hops.map((hop) => hop.layer),
    takeoffAngleDeg: hops[0] ? hops[0].takeoffAngleRad * RAD_TO_DEG : 0,
    eirpDbm: linkBudget.eirpDbm,
    fsplDb: linkBudget.fsplDb,
    perHopAbsorption,
    totalAbsorptionDb,
    perBounceGroundReflection,
    totalGroundReflectionDb,
    polarisationDb: linkBudget.polarisationDb,
    receivedPowerDbm: linkBudget.receivedPowerDbm,
    noiseFloorDbm: linkBudget.noiseFloorDbm,
    snrDb2400: linkBudget.snrDb2400,
    mufMhz: linkBudget.mufMhz,
    modeVerdicts,
  };
}
