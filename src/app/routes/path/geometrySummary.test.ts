import { describe, expect, it } from 'vitest';
import { computeAngleShortfall } from './geometrySummary.ts';

/** A synthetic low-angle-favouring pattern -- peak near the horizon, falling off steeply toward zenith (a caricature of a low horizontal dipole's NVIS-poor shape). */
function lowAngleFavouringGainDbi(elevationDeg: number): number {
  return 5 - (elevationDeg / 90) * 20;
}

/** A synthetic pattern whose peak sits at a steep NVIS-range angle. */
function nvisFavouringGainDbi(elevationDeg: number): number {
  return 5 - Math.abs(elevationDeg - 70) * 0.5;
}

describe('computeAngleShortfall', () => {
  it('flags a large shortfall when the required angle is far from a low-angle-favouring peak', () => {
    const result = computeAngleShortfall(80, lowAngleFavouringGainDbi);
    expect(result.peakElevationDeg).toBe(0);
    expect(result.shortfallDb).toBeGreaterThan(6);
    expect(result.flagged).toBe(true);
  });

  it('reports no meaningful shortfall when the required angle sits at the pattern peak', () => {
    const result = computeAngleShortfall(70, nvisFavouringGainDbi);
    expect(result.peakElevationDeg).toBe(70);
    expect(result.shortfallDb).toBeCloseTo(0, 5);
    expect(result.flagged).toBe(false);
  });

  it('shortfallDb is always non-negative by construction', () => {
    for (const requiredDeg of [0, 15, 45, 89]) {
      const result = computeAngleShortfall(requiredDeg, nvisFavouringGainDbi);
      expect(result.shortfallDb).toBeGreaterThanOrEqual(0);
    }
  });
});
