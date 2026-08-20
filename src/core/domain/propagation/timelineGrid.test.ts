import { describe, expect, it } from 'vitest';
import { ssnFromSfi } from './losses';
import {
  computeTimelineGrid,
  TIMELINE_HOURS_PER_DAY,
  type TimelineGridInput,
} from './timelineGrid';
import { UK_AMATEUR_BANDS } from '../bandCatalog';

const STANDARD_INPUT_BASE = {
  groundType: 'land' as const,
  noiseEnvironment: 'rural' as const,
  txPowerW: 100,
  txAntennaGainDbi: 6,
  rxAntennaGainDbi: 6,
};

/**
 * A mid-latitude London-ish station, an east-west 3000km path (20m
 * midpoint 14.175MHz -- verdictTable.test.ts's own Anchor-A-adjacent
 * frequency), SFI 120/Kp 1, mid-June -- confirmed empirically (see this
 * phase's PR description for the sweep) to cross the terminator with a
 * distinct reliability bump at dawn (hour 5, station solar zenith ~80.6deg)
 * relative to both the full-night hour immediately before (hour 4,
 * unreachable) and the "already well into day" hour immediately after
 * (hour 6, solar zenith ~71.9deg, reliability dips below hour 5's).
 */
function greylineInput(bandId: string, frequencyMhz: number): TimelineGridInput {
  return {
    ...STANDARD_INPUT_BASE,
    stationLatLon: [51.5, -0.1],
    bearingToTargetDeg: 90,
    distanceKm: 3000,
    dateUtc: { year: 2026, month: 6, day: 21 },
    sfi: 120,
    kp: 1,
    geomagLatDeg: 45,
    ssn: ssnFromSfi(120),
    bands: [{ id: bandId, frequencyMhz }],
  };
}

describe('computeTimelineGrid', () => {
  it('is visible: the terminator-straddling dawn hour outranks both its full-night and full-day neighbours', () => {
    const grid = computeTimelineGrid(greylineInput('20m', 14.175));
    const byHour = new Map(grid.map((cell) => [cell.hourUtc, cell]));

    const nightHour = byHour.get(4)!;
    const dawnHour = byHour.get(5)!;
    const dayHour = byHour.get(6)!;

    expect(dawnHour.reliability).toBeGreaterThan(nightHour.reliability);
    expect(dawnHour.reliability).toBeGreaterThan(dayHour.reliability);
    expect(dawnHour.bucket).not.toBe('unlikely');
  });

  it('produces bands.length * 24 cells for the standard 10-band x 24-hour sweep', () => {
    const input: TimelineGridInput = {
      ...STANDARD_INPUT_BASE,
      stationLatLon: [51.5, -0.1],
      bearingToTargetDeg: 90,
      distanceKm: 2000,
      dateUtc: { year: 2026, month: 3, day: 21 },
      sfi: 120,
      kp: 0,
      geomagLatDeg: 45,
      ssn: ssnFromSfi(120),
      bands: UK_AMATEUR_BANDS.map((band) => ({
        id: band.id,
        frequencyMhz: (band.minMhz + band.maxMhz) / 2,
      })),
    };

    const grid = computeTimelineGrid(input);
    expect(grid).toHaveLength(UK_AMATEUR_BANDS.length * TIMELINE_HOURS_PER_DAY);
  });

  it('produces reliability: 0, bucket: "unlikely" cells (not a thrown error) for an unreachable distance', () => {
    const input: TimelineGridInput = {
      ...STANDARD_INPUT_BASE,
      stationLatLon: [51.5, -0.1],
      bearingToTargetDeg: 90,
      // Beyond any achievable hop geometry (5 hops max, per multiHop.ts) --
      // matches verdictTable.test.ts's own "target beyond every band's
      // achievable geometry" scenario, scaled further for headroom.
      distanceKm: 30000,
      dateUtc: { year: 2026, month: 3, day: 21 },
      sfi: 120,
      kp: 0,
      geomagLatDeg: 45,
      ssn: ssnFromSfi(120),
      bands: [{ id: '20m', frequencyMhz: 14.175 }],
    };

    const grid = computeTimelineGrid(input);
    expect(grid).toHaveLength(TIMELINE_HOURS_PER_DAY);
    for (const cell of grid) {
      expect(cell.hopSolve.kind).toBe('unreachable');
      expect(cell.reliability).toBe(0);
      expect(cell.bucket).toBe('unlikely');
    }
  });

  // Threshold derivation (not a design-doc number -- see this phase's plan
  // file's "Computation shape" section): the coverage grid's own
  // ~19,000-iteration sweep already fits a ~150ms off-main-thread budget;
  // Timeline's ~3,600-link-budget-call sweep (10 bands x 24 hours x up to
  // 5 hop counts x 3 layers) is roughly 5x smaller, so ~20ms is the
  // proportionate synchronous, on-main-thread budget for it.
  const BENCHMARK_THRESHOLD_MS = 20;

  it(`completes the full 240-cell sweep within ${BENCHMARK_THRESHOLD_MS}ms`, () => {
    const input: TimelineGridInput = {
      ...STANDARD_INPUT_BASE,
      stationLatLon: [51.5, -0.1],
      bearingToTargetDeg: 90,
      distanceKm: 3000,
      dateUtc: { year: 2026, month: 6, day: 21 },
      sfi: 120,
      kp: 1,
      geomagLatDeg: 45,
      ssn: ssnFromSfi(120),
      bands: UK_AMATEUR_BANDS.map((band) => ({
        id: band.id,
        frequencyMhz: (band.minMhz + band.maxMhz) / 2,
      })),
    };

    const start = performance.now();
    const grid = computeTimelineGrid(input);
    const elapsedMs = performance.now() - start;

    expect(grid).toHaveLength(UK_AMATEUR_BANDS.length * TIMELINE_HOURS_PER_DAY);
    expect(elapsedMs).toBeLessThan(BENCHMARK_THRESHOLD_MS);
  });
});
