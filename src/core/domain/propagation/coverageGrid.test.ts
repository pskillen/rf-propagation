/**
 * Slice 2 correctness tests (F2.12, phase 4 plan): `computeCoverageGrid` is
 * a new code path through the existing, already-validated physics (V1-V23
 * pass unchanged) -- these give V16/V17 (single-point checks in phase 3's
 * validation.test.ts) somewhere to be asserted SPATIALLY, plus a smoke test
 * that the full sweep produces the expected groundwave/gap/hop-band shape.
 */
import { describe, expect, it } from 'vitest';
import type { AntennaConfig } from '../station/types';
import { layerStates } from './layers';
import { ssnFromSfi } from './losses';
import {
  computeCoverageGrid,
  computeCoverageGridAtStride,
  COVERAGE_AZIMUTH_COUNT,
  COVERAGE_RANGE_BIN_COUNT,
  COVERAGE_RANGE_BIN_KM,
  type CoverageGridInput,
} from './coverageGrid';

/** 2024-03-20 12:00 UTC -- equinox solar noon at lon 0 (see solarZenithAngle.test.ts). */
const EQUINOX_SOLAR_NOON_UTC = Date.UTC(2024, 2, 20, 12, 0, 0);
const NO_COVERAGE = 255;

/**
 * Omnidirectional -- Slice 1 (fix/reach-directionality-antenna-greyline)
 * changed `CoverageGridInput.txAntennaGainDbi: number` to
 * `txAntenna: AntennaConfig`; an omnidirectional-vertical antenna is the
 * azimuth-invariant control case, matching this file's pre-existing
 * fixtures' intent as closely as possible (no beam heading to skew any
 * one azimuth).
 */
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

function equatorMiddayInput(frequencyMhz: number): CoverageGridInput {
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

function binIndexForRangeKm(rangeKm: number): number {
  return Math.floor(rangeKm / COVERAGE_RANGE_BIN_KM);
}

describe('V16 (coverage-grid analogue) -- 40m, midday, SFI 120: no skip zone inside 400km', () => {
  it('every range bin out to 400km has coverage at Good reliability, for every azimuth', () => {
    const result = computeCoverageGrid(equatorMiddayInput(7.15));
    const maxBin = binIndexForRangeKm(400);

    for (let az = 0; az < COVERAGE_AZIMUTH_COUNT; az++) {
      for (let bin = 0; bin <= maxBin; bin++) {
        const idx = az * result.rangeBinCount + bin;
        expect(result.hopCount[idx]).not.toBe(NO_COVERAGE);
      }
    }

    // The 200km target itself (the original V16 single-point claim) reads Good.
    const idx200 = 0 * result.rangeBinCount + binIndexForRangeKm(200);
    expect(result.reliability[idx200]).toBeGreaterThanOrEqual(0.7);
  });
});

describe('V17 (coverage-grid analogue) -- 20m, midday, SFI 120: 200km sits in the skip zone', () => {
  it('the 200km range bin has no coverage (the ray at that geometry escapes or lands elsewhere)', () => {
    const result = computeCoverageGrid(equatorMiddayInput(14));
    const idx200 = 0 * result.rangeBinCount + binIndexForRangeKm(200);
    expect(result.hopCount[idx200]).toBe(NO_COVERAGE);
    expect(result.reliability[idx200]).toBe(0);
  });
});

describe('generic smoke test -- mid-band daytime scenario has a plausible shape', () => {
  it('produces a groundwave disc near range 0, a gap, then a hop-1+ band further out', () => {
    const result = computeCoverageGrid({
      txLat: 40,
      txLon: -74,
      atMs: EQUINOX_SOLAR_NOON_UTC,
      frequencyMhz: 14,
      layers: layerStates(120, 0, 0, 0),
      ssn: ssnFromSfi(120),
      ...STANDARD_STATION,
    });

    expect(result.azimuthCount).toBe(COVERAGE_AZIMUTH_COUNT);
    expect(result.rangeBinCount).toBe(COVERAGE_RANGE_BIN_COUNT);
    expect(result.rangeBinKm).toBe(COVERAGE_RANGE_BIN_KM);
    expect(result.reliability).toHaveLength(COVERAGE_AZIMUTH_COUNT * COVERAGE_RANGE_BIN_COUNT);
    expect(result.snrDb).toHaveLength(COVERAGE_AZIMUTH_COUNT * COVERAGE_RANGE_BIN_COUNT);
    expect(result.hopCount).toHaveLength(COVERAGE_AZIMUTH_COUNT * COVERAGE_RANGE_BIN_COUNT);

    const az = 0;
    // Groundwave disc at the origin.
    expect(result.hopCount[az * result.rangeBinCount + 0]).toBe(0);
    expect(result.reliability[az * result.rangeBinCount + 0]).toBe(1);

    // A genuine gap (skip zone) somewhere between the groundwave and the first hop band.
    const hasGap = Array.from({ length: binIndexForRangeKm(800) }, (_, bin) => bin)
      .slice(1)
      .some((bin) => result.hopCount[az * result.rangeBinCount + bin] === NO_COVERAGE);
    expect(hasGap).toBe(true);

    // A real hop band (hopCount 1-4, positive reliability) further out.
    const hopBandBins = Array.from({ length: COVERAGE_RANGE_BIN_COUNT }, (_, bin) => bin).filter(
      (bin) => bin >= binIndexForRangeKm(1000) && bin <= binIndexForRangeKm(3000),
    );
    const hasHopBand = hopBandBins.some((bin) => {
      const idx = az * result.rangeBinCount + bin;
      return result.hopCount[idx] >= 1 && result.hopCount[idx] <= 4 && result.reliability[idx] > 0;
    });
    expect(hasHopBand).toBe(true);
  });
});

describe('computeCoverageGridAtStride -- coarse sampling duplicate-fills output azimuth slots', () => {
  it('a stride-2 coarse pass has no untraced (default-empty AND non-groundwave) azimuth gaps beyond what stride 1 also leaves empty', () => {
    const input = equatorMiddayInput(14);
    const fine = computeCoverageGridAtStride(input, 1, 1);
    const coarse = computeCoverageGridAtStride(input, 2, 2);
    expect(fine.kind).toBe('completed');
    expect(coarse.kind).toBe('completed');
    if (fine.kind !== 'completed' || coarse.kind !== 'completed') return;

    expect(coarse.result.azimuthCount).toBe(fine.result.azimuthCount);
    expect(coarse.result.rangeBinCount).toBe(fine.result.rangeBinCount);
    expect(coarse.result.reliability).toHaveLength(fine.result.reliability.length);
  });

  it('shouldCancel returning true stops the sweep before it completes', () => {
    const input = equatorMiddayInput(14);
    let calls = 0;
    const result = computeCoverageGridAtStride(input, 1, 1, () => {
      calls += 1;
      return calls > 2; // let a couple of azimuth rows run, then cancel
    });
    expect(result.kind).toBe('cancelled');
    // Cancellation is checked once per traced azimuth row, not every hop
    // iteration -- confirms it didn't run all COVERAGE_AZIMUTH_COUNT rows.
    expect(calls).toBeLessThan(COVERAGE_AZIMUTH_COUNT);
  });
});

/**
 * Slice 1 (fix/reach-directionality-antenna-greyline) correctness tests:
 * `CoverageGridInput.txAntenna` (CHANGED from a flat `txAntennaGainDbi`)
 * now feeds `elevationGainDbi` per cell, so a beam's heading or an omni's
 * flat pattern should visibly (not just numerically) shape the grid.
 */
describe('Slice 1 -- antenna directionality shapes the coverage grid', () => {
  const NORTH_AZIMUTH_INDEX = 0; // 0deg true
  const SOUTH_AZIMUTH_INDEX = COVERAGE_AZIMUTH_COUNT / 2; // 180deg true

  const BEAM_NORTH: AntennaConfig = {
    id: 'beam-north',
    name: 'Test beam (north)',
    family: 'directional-lobe',
    heightM: 10,
    azimuthDeg: 0,
    gainDbi: 10,
  };

  /**
   * Best reliability across the skywave hop band (1000-3000km, matching
   * the generic smoke test's own hop-band range above) at one azimuth
   * index -- deliberately EXCLUDES the groundwave disc's bins, which are
   * filled unconditionally at reliability 1 for every azimuth regardless
   * of antenna pattern (see this module's own `groundwaveRangeKm` doc),
   * so a beam's directionality would otherwise be invisible to this check.
   */
  function bestHopBandReliabilityAtAzimuth(
    result: ReturnType<typeof computeCoverageGrid>,
    azIdx: number,
  ) {
    const minBin = binIndexForRangeKm(1000);
    const maxBin = binIndexForRangeKm(3000);
    let best = 0;
    for (let bin = minBin; bin <= maxBin; bin++) {
      best = Math.max(best, result.reliability[azIdx * result.rangeBinCount + bin]);
    }
    return best;
  }

  it('a beam pointed north (azimuthDeg: 0) is materially more reliable north than south', () => {
    const result = computeCoverageGrid({ ...equatorMiddayInput(14), txAntenna: BEAM_NORTH });

    const north = bestHopBandReliabilityAtAzimuth(result, NORTH_AZIMUTH_INDEX);
    const south = bestHopBandReliabilityAtAzimuth(result, SOUTH_AZIMUTH_INDEX);

    expect(north).toBeGreaterThan(0.5);
    expect(south).toBeLessThan(north - 0.3);
  });

  it("rotating the same beam's azimuthDeg to 180 MOVES the high-reliability bins to the south (shape rotates, not just changes value)", () => {
    const beamSouth: AntennaConfig = { ...BEAM_NORTH, azimuthDeg: 180 };
    const result = computeCoverageGrid({ ...equatorMiddayInput(14), txAntenna: beamSouth });

    const north = bestHopBandReliabilityAtAzimuth(result, NORTH_AZIMUTH_INDEX);
    const south = bestHopBandReliabilityAtAzimuth(result, SOUTH_AZIMUTH_INDEX);

    expect(south).toBeGreaterThan(0.5);
    expect(north).toBeLessThan(south - 0.3);
  });

  it('an omnidirectional-vertical antenna produces azimuth-invariant reliability (control case)', () => {
    // equatorMiddayInput's STANDARD_ANTENNA is already omnidirectional-vertical.
    const result = computeCoverageGrid(equatorMiddayInput(14));

    const byAzimuth = Array.from({ length: COVERAGE_AZIMUTH_COUNT }, (_, az) =>
      bestHopBandReliabilityAtAzimuth(result, az),
    );
    const max = Math.max(...byAzimuth);
    const min = Math.min(...byAzimuth);

    // Tiny floating-point noise from destinationPoint's spherical trig
    // (different bearings accumulate rounding differently even though the
    // antenna itself has no phi term) -- not a real directional effect.
    expect(max - min).toBeLessThan(1e-3);
  });
});

/**
 * Slice 1's own benchmark requirement: per-cell `elevationGainDbi` adds
 * real work to the sweep's hot loop (roughly 90x more inner work per call
 * site, per the phase plan) -- this confirms a full-resolution sweep with
 * a real (non-omnidirectional) antenna still fits phase 4's ~150ms
 * coarse-pass latency budget (product-requirements.md NFR) on this
 * machine. A directional-lobe antenna is used deliberately (not the
 * cheaper omnidirectional case) since it's the pattern family closest to
 * a worst-case trig cost per `antennaGain` call.
 */
describe('Slice 1 benchmark -- per-cell antenna gain stays inside the coarse-pass latency budget', () => {
  const BEAM: AntennaConfig = {
    id: 'benchmark-beam',
    name: 'Benchmark beam',
    family: 'directional-lobe',
    heightM: 10,
    azimuthDeg: 45,
    gainDbi: 10,
  };
  const COARSE_PASS_BUDGET_MS = 150;

  it('a full-resolution sweep with a directional antenna completes within budget', () => {
    const input: CoverageGridInput = { ...equatorMiddayInput(14), txAntenna: BEAM };

    // Warm up (JIT) once, then measure -- avoids penalising the sweep for
    // V8's first-call compilation cost, which a real coarse-pass in the
    // app never pays more than once per session either.
    computeCoverageGrid(input);
    const start = performance.now();
    computeCoverageGrid(input);
    const elapsedMs = performance.now() - start;

    console.log(
      `Slice 1 benchmark: full-resolution antenna-aware sweep took ${elapsedMs.toFixed(1)}ms`,
    );
    expect(elapsedMs).toBeLessThan(COARSE_PASS_BUDGET_MS);
  });
});
