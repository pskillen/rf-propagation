import { describe, expect, it } from 'vitest';
import type { AntennaConfig } from '../station/types';
import { layerStates } from './layers';
import { ssnFromSfi } from './losses';
import type { CoverageGridInput } from './coverageGrid';
import { generateIllustrationRays } from './illustrationRays';
import { computeIllustrationRayBudget } from './rayLinkBudget';

const EQUINOX_MIDNIGHT_UTC = Date.UTC(2024, 2, 20, 0, 0, 0);
const EQUINOX_SOLAR_NOON_UTC = Date.UTC(2024, 2, 20, 12, 0, 0);

const STANDARD_ANTENNA: AntennaConfig = {
  id: 'standard-test-antenna',
  name: 'Test vertical',
  family: 'omnidirectional-vertical',
  heightM: 10,
  gainDbi: 6,
};

const STANDARD_STATION = {
  txPowerW: 100,
  txAntenna: STANDARD_ANTENNA,
  rxAntennaGainDbi: 6,
  groundType: 'land' as const,
  noiseEnvironment: 'rural' as const,
  bandwidthHz: 2400,
};

function contextAtNight(frequencyMhz: number): CoverageGridInput {
  return {
    txLat: 0,
    txLon: 0,
    atMs: EQUINOX_MIDNIGHT_UTC,
    frequencyMhz,
    layers: layerStates(120, 0, 150, 0),
    ssn: ssnFromSfi(120),
    ...STANDARD_STATION,
  };
}

function contextAtNoon(frequencyMhz: number): CoverageGridInput {
  return {
    txLat: 0,
    txLon: 0,
    atMs: EQUINOX_SOLAR_NOON_UTC,
    frequencyMhz,
    layers: layerStates(120, 0, 0, 0),
    ssn: ssnFromSfi(120),
    ...STANDARD_STATION,
  };
}

describe('computeIllustrationRayBudget', () => {
  it('returns null for an escaped ray (no reflecting layer, nothing to budget)', () => {
    const context = contextAtNoon(100); // far above every layer's MUF -- always escapes
    const [ray] = generateIllustrationRays(
      { radialCount: 1, elevationCount: 1, elevationSpreadDeg: [45, 45], mode: 'rose' },
      context,
    );
    expect(ray!.outcome).toBe('escaped');
    expect(computeIllustrationRayBudget(ray!, context)).toBeNull();
  });

  it('returns a full LinkBudgetResult for a returned ray, with a finite SNR', () => {
    const context = contextAtNight(3.6); // V11 scenario -- both ends dark, no D-layer absorption
    const [ray] = generateIllustrationRays(
      { radialCount: 1, elevationCount: 1, elevationSpreadDeg: [45, 45], mode: 'rose' },
      context,
    );
    expect(ray!.outcome).toBe('returned');
    const budget = computeIllustrationRayBudget(ray!, context);
    expect(budget).not.toBeNull();
    expect(Number.isFinite(budget!.snrDb2400)).toBe(true);
    expect(Number.isFinite(budget!.mufMhz)).toBe(true);
    expect(budget!.absorptionDb).toBe(0); // both ends dark -- no D-layer absorption, same as V11
  });

  it('agrees with a second independent trace at the same azimuth/elevation (deterministic reconstruction)', () => {
    const context = contextAtNight(3.6);
    const [rayA] = generateIllustrationRays(
      { radialCount: 1, elevationCount: 1, elevationSpreadDeg: [45, 45], mode: 'rose' },
      context,
    );
    const [rayB] = generateIllustrationRays(
      { radialCount: 1, elevationCount: 1, elevationSpreadDeg: [45, 45], mode: 'rose' },
      context,
    );
    const budgetA = computeIllustrationRayBudget(rayA!, context);
    const budgetB = computeIllustrationRayBudget(rayB!, context);
    expect(budgetA).toEqual(budgetB);
  });
});
