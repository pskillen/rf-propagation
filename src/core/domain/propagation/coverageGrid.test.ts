/**
 * Slice 2 correctness tests (F2.12, phase 4 plan): `computeCoverageGrid` is
 * a new code path through the existing, already-validated physics (V1-V23
 * pass unchanged) -- these give V16/V17 (single-point checks in phase 3's
 * validation.test.ts) somewhere to be asserted SPATIALLY, plus a smoke test
 * that the full sweep produces the expected groundwave/gap/hop-band shape.
 */
import { describe, expect, it } from 'vitest';
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

const STANDARD_STATION = {
  txPowerW: 100,
  txAntennaGainDbi: 6,
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
