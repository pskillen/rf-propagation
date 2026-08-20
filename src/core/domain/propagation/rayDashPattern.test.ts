import { describe, expect, it } from 'vitest';
import type { IllustrationRay } from './illustrationRays';
import { rayDashLengthFraction, rayGapLengthFraction } from './rayDashPattern';

function rayWithOutcome(outcome: IllustrationRay['outcome']): IllustrationRay {
  return { azimuthDeg: 0, elevationDeg: 30, outcome, reflectingLayers: [], points: [] };
}

const TOTAL_ARC_RAD = 10 * (Math.PI / 180);

describe('rayDashLengthFraction / rayGapLengthFraction', () => {
  it.each(['returned', 'absorbed', 'escaped'] as const)(
    "%s ray's dash and gap fractions are within [0, 1]",
    (outcome) => {
      const ray = rayWithOutcome(outcome);
      expect(rayDashLengthFraction(ray, TOTAL_ARC_RAD)).toBeGreaterThanOrEqual(0);
      expect(rayDashLengthFraction(ray, TOTAL_ARC_RAD)).toBeLessThanOrEqual(1);
      expect(rayGapLengthFraction(ray, TOTAL_ARC_RAD)).toBeGreaterThanOrEqual(0);
      expect(rayGapLengthFraction(ray, TOTAL_ARC_RAD)).toBeLessThanOrEqual(1);
    },
  );

  it('absorbed rays have a sparser dash (smaller dash-to-gap ratio) than returned rays', () => {
    const absorbed = rayWithOutcome('absorbed');
    const returned = rayWithOutcome('returned');
    const absorbedRatio =
      rayDashLengthFraction(absorbed, TOTAL_ARC_RAD) /
      rayGapLengthFraction(absorbed, TOTAL_ARC_RAD);
    const returnedRatio =
      rayDashLengthFraction(returned, TOTAL_ARC_RAD) /
      rayGapLengthFraction(returned, TOTAL_ARC_RAD);
    expect(absorbedRatio).toBeLessThan(returnedRatio);
  });

  it('clamps to 0 for a non-finite or non-positive total arc length', () => {
    const ray = rayWithOutcome('returned');
    expect(rayDashLengthFraction(ray, 0)).toBe(0);
    expect(rayDashLengthFraction(ray, -1)).toBe(0);
    expect(rayDashLengthFraction(ray, NaN)).toBe(0);
  });

  it('clamps to 1 when the dash/gap arc exceeds a very short total arc length', () => {
    const ray = rayWithOutcome('returned');
    const tinyArcRad = 0.0001 * (Math.PI / 180);
    expect(rayDashLengthFraction(ray, tinyArcRad)).toBe(1);
  });
});
