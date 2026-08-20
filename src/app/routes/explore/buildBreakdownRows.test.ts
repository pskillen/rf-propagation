/**
 * "The numbers reconcile to the stated SNR" (F8.5's own acceptance
 * criterion). Run against phase 3's calibration Anchor A (3360km, single
 * F2 hop by the anchor's own hand-picked geometry) and Anchor B (5000km,
 * two F2 hops) scenarios -- same station/conditions/distance
 * (validation.test.ts's own STANDARD_STATION, SFI 120, daytime, 20m),
 * fed through the REAL production path (`solveHopsForDistance`, not the
 * anchor's hand-picked hop). `multiHop.ts`'s own doc comment already
 * flags that the honestly-validated search resolves these distances to
 * one hop MORE than each anchor's hand-picked figure (E intercepts first
 * at the anchors' shallow angles) -- this test doesn't depend on matching
 * the anchor's exact hop count, only on the breakdown reconciling to
 * whatever `solveHopsForDistance` actually returns.
 */
import { describe, expect, it } from 'vitest';
import { layerStates } from '@core/domain/propagation/layers';
import { ssnFromSfi } from '@core/domain/propagation/losses';
import { solveHopsForDistance, type SolveHopsContext } from '@core/domain/propagation/multiHop';
import { buildLinkBudgetBreakdown } from './buildBreakdownRows.ts';

const DAYTIME_LAYERS = layerStates(120, 0, 0, 0);

const CONTEXT: SolveHopsContext = {
  ssn: ssnFromSfi(120),
  groundType: 'land',
  noiseEnvironment: 'rural',
  txPowerW: 100,
  txAntennaGainDbi: 6,
  rxAntennaGainDbi: 6,
  bandwidthHz: 2400,
  solarZenithAtMidpointDeg: () => 0, // daytime throughout, matching the anchors' own daytime scenario
};

const FREQUENCY_MHZ = 14;
const FLOAT_TOLERANCE = 1e-6;

describe.each([
  ['Anchor A distance (3360km)', 3360],
  ['Anchor B distance (5000km)', 5000],
])('buildLinkBudgetBreakdown reconciliation -- %s', (_label, groundRangeKm) => {
  it('reconciles every summed row to LinkBudgetResult’s own totals', () => {
    const solved = solveHopsForDistance(groundRangeKm, FREQUENCY_MHZ, DAYTIME_LAYERS, CONTEXT);
    expect(solved.kind).toBe('solved');
    if (solved.kind !== 'solved') return;

    const breakdown = buildLinkBudgetBreakdown(solved.solution, {
      frequencyMhz: FREQUENCY_MHZ,
      ssn: CONTEXT.ssn,
      groundType: CONTEXT.groundType,
    });
    const { linkBudget } = solved.solution;

    const summedAbsorptionDb = breakdown.perHopAbsorption.reduce((s, r) => s + r.absorptionDb, 0);
    expect(summedAbsorptionDb).toBeCloseTo(linkBudget.absorptionDb, 9);
    expect(breakdown.totalAbsorptionDb).toBeCloseTo(linkBudget.absorptionDb, 9);

    const summedGroundDb = breakdown.perBounceGroundReflection.reduce((s, r) => s + r.lossDb, 0);
    expect(summedGroundDb).toBeCloseTo(linkBudget.groundReflectionDb, 9);
    expect(breakdown.totalGroundReflectionDb).toBeCloseTo(linkBudget.groundReflectionDb, 9);

    const reconstructedReceivedPowerDbm =
      breakdown.eirpDbm -
      breakdown.fsplDb -
      summedAbsorptionDb -
      summedGroundDb -
      breakdown.polarisationDb +
      CONTEXT.rxAntennaGainDbi;
    expect(Math.abs(reconstructedReceivedPowerDbm - linkBudget.receivedPowerDbm)).toBeLessThan(
      FLOAT_TOLERANCE,
    );

    expect(breakdown.receivedPowerDbm - breakdown.noiseFloorDbm).toBeCloseTo(
      breakdown.snrDb2400,
      9,
    );

    expect(breakdown.hopCount).toBe(solved.solution.hopCount);
    expect(breakdown.reflectingLayers).toEqual(solved.solution.hops.map((h) => h.layer));
    expect(breakdown.modeVerdicts).toHaveLength(3);
    for (const verdict of breakdown.modeVerdicts) {
      expect(['good', 'marginal', 'unlikely']).toContain(verdict.bucket);
    }
  });
});
