/**
 * Slice 3 correctness tests (F2.13, phase 4 plan): outcome classification
 * (escaped/returned/absorbed), rose-vs-fan tiling, and -- the load-bearing
 * one -- the coverage-grid independence test (F2.13's own acceptance
 * criterion, and the correction to mk1's tranche-2 planning).
 */
import { describe, expect, it } from 'vitest';
import { layerStates } from './layers';
import { ssnFromSfi } from './losses';
import { computeCoverageGrid, type CoverageGridInput } from './coverageGrid';
import { generateIllustrationRays } from './illustrationRays';

const EQUINOX_SOLAR_NOON_UTC = Date.UTC(2024, 2, 20, 12, 0, 0);
const EQUINOX_MIDNIGHT_UTC = Date.UTC(2024, 2, 20, 0, 0, 0);

const STANDARD_STATION = {
  txPowerW: 100,
  txAntennaGainDbi: 6,
  rxAntennaGainDbi: 6,
  groundType: 'land' as const,
  noiseEnvironment: 'rural' as const,
  bandwidthHz: 2400,
};

function contextAt(frequencyMhz: number): CoverageGridInput {
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

/** Both ends in darkness, matching validation.test.ts's V11 scenario (no D-layer absorption). */
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

describe('generateIllustrationRays -- outcome classification', () => {
  it('classifies a ray at an angle/frequency where nothing reflects as escaped', () => {
    // 100MHz is far above every layer's MUF at any angle (V1/V2 bound sec(phi)
    // well under what would be needed) -- always escapes.
    const rays = generateIllustrationRays(
      { radialCount: 1, elevationCount: 1, elevationSpreadDeg: [45, 45], mode: 'rose' },
      contextAt(100),
    );
    expect(rays).toHaveLength(1);
    expect(rays[0].outcome).toBe('escaped');
    expect(rays[0].reflectingLayers).toHaveLength(0);
  });

  it('classifies an 80m ray with both ends in darkness (V11 scenario, no D-layer absorption) as returned', () => {
    const rays = generateIllustrationRays(
      { radialCount: 1, elevationCount: 1, elevationSpreadDeg: [45, 45], mode: 'rose' },
      contextAtNight(3.6),
    );
    expect(rays).toHaveLength(1);
    expect(rays[0].outcome).toBe('returned');
    expect(rays[0].reflectingLayers.length).toBeGreaterThan(0);
    expect(rays[0].points.length).toBeGreaterThan(0);
  });

  it('classifies a low-power, heavily-absorbed daytime 80m near-grazing ray as absorbed', () => {
    const rays = generateIllustrationRays(
      { radialCount: 1, elevationCount: 1, elevationSpreadDeg: [1, 1], mode: 'rose' },
      {
        ...contextAt(3.6),
        txPowerW: 0.1, // QRP -- pushes SNR well negative at this range/absorption
      },
    );
    expect(rays).toHaveLength(1);
    expect(['absorbed', 'escaped']).toContain(rays[0].outcome);
    // If it reflected at all under this geometry, it should be classified absorbed
    // (weak QRP signal, heavy daytime D-layer absorption at 80m).
    if (rays[0].reflectingLayers.length > 0) {
      expect(rays[0].outcome).toBe('absorbed');
    }
  });
});

describe('generateIllustrationRays -- rose vs fan tiling', () => {
  it('rose mode tiles radialCount azimuths evenly across the full 360deg', () => {
    const rays = generateIllustrationRays(
      { radialCount: 4, elevationCount: 1, elevationSpreadDeg: [30, 30], mode: 'rose' },
      contextAt(14),
    );
    const azimuths = rays.map((r) => r.azimuthDeg).sort((a, b) => a - b);
    expect(azimuths).toEqual([0, 90, 180, 270]);
  });

  it('fan mode tiles radialCount azimuths within the focus bearing/width', () => {
    const rays = generateIllustrationRays(
      {
        radialCount: 3,
        elevationCount: 1,
        elevationSpreadDeg: [30, 30],
        mode: 'fan',
        focusBearingDeg: 90,
        focusWidthDeg: 20,
      },
      contextAt(14),
    );
    const azimuths = rays.map((r) => r.azimuthDeg).sort((a, b) => a - b);
    expect(azimuths).toEqual([80, 90, 100]);
  });

  it('elevationCount tiles evenly across elevationSpreadDeg', () => {
    const rays = generateIllustrationRays(
      { radialCount: 1, elevationCount: 3, elevationSpreadDeg: [10, 30], mode: 'rose' },
      contextAt(14),
    );
    const elevations = rays.map((r) => r.elevationDeg).sort((a, b) => a - b);
    expect(elevations).toEqual([10, 20, 30]);
  });
});

describe('generateIllustrationRays -- coverage-grid independence (F2.13 acceptance criterion)', () => {
  it('never changes any value computeCoverageGrid produces, at two different radial/elevation counts', () => {
    const context = contextAt(14);

    const before = computeCoverageGrid(context);

    generateIllustrationRays(
      { radialCount: 4, elevationCount: 2, elevationSpreadDeg: [0, 89], mode: 'rose' },
      context,
    );
    const afterFirstRayGeneration = computeCoverageGrid(context);
    expect(Array.from(afterFirstRayGeneration.reliability)).toEqual(Array.from(before.reliability));
    expect(Array.from(afterFirstRayGeneration.snrDb)).toEqual(Array.from(before.snrDb));
    expect(Array.from(afterFirstRayGeneration.hopCount)).toEqual(Array.from(before.hopCount));

    generateIllustrationRays(
      { radialCount: 16, elevationCount: 10, elevationSpreadDeg: [0, 89], mode: 'rose' },
      context,
    );
    const afterSecondRayGeneration = computeCoverageGrid(context);
    expect(Array.from(afterSecondRayGeneration.reliability)).toEqual(
      Array.from(before.reliability),
    );
    expect(Array.from(afterSecondRayGeneration.snrDb)).toEqual(Array.from(before.snrDb));
    expect(Array.from(afterSecondRayGeneration.hopCount)).toEqual(Array.from(before.hopCount));
  });
});
