import { describe, expect, it } from 'vitest';
import { formatReachExtremes, rankBandsByMeanReliability, reachExtremes } from './reachSummary.ts';

const NO_DATA = 255;

/** Builds a 1-azimuth-wide fixture grid with a given hopCount/reliability per rangeBin -- azimuth doesn't matter for these tests, so a single row keeps fixtures readable. */
function fixtureGrid(cells: Array<{ hopCount: number; reliability: number }>) {
  const rangeBinCount = cells.length;
  return {
    azimuthCount: 1,
    rangeBinCount,
    rangeBinKm: 50,
    reliability: Float32Array.from(cells.map((c) => c.reliability)),
    hopCount: Uint8Array.from(cells.map((c) => c.hopCount)),
  };
}

describe('reachExtremes', () => {
  it('finds min/max populated rangeBin per hopCount, with a deliberate skip-zone gap', () => {
    // bins 0-1: groundwave; bins 2-3: skip zone (no data); bins 4-6: hop 1.
    const grid = fixtureGrid([
      { hopCount: 0, reliability: 1 },
      { hopCount: 0, reliability: 1 },
      { hopCount: NO_DATA, reliability: 0 },
      { hopCount: NO_DATA, reliability: 0 },
      { hopCount: 1, reliability: 0.8 },
      { hopCount: 1, reliability: 0.7 },
      { hopCount: 1, reliability: 0.6 },
    ]);

    const extremes = reachExtremes(grid);

    expect(extremes).toEqual([
      { hopCount: 0, minRangeKm: 0, maxRangeKm: 100 }, // bins 0-1 -> 0 to (1+1)*50
      { hopCount: 1, minRangeKm: 200, maxRangeKm: 350 }, // bins 4-6 -> 4*50 to (6+1)*50
    ]);
  });

  it('returns an empty array for an all-skip-zone grid', () => {
    const grid = fixtureGrid([
      { hopCount: NO_DATA, reliability: 0 },
      { hopCount: NO_DATA, reliability: 0 },
    ]);
    expect(reachExtremes(grid)).toEqual([]);
  });

  it('sorts categories ascending by hopCount, groundwave first', () => {
    const grid = fixtureGrid([
      { hopCount: 2, reliability: 0.5 },
      { hopCount: 0, reliability: 1 },
      { hopCount: 1, reliability: 0.7 },
    ]);
    expect(reachExtremes(grid).map((e) => e.hopCount)).toEqual([0, 1, 2]);
  });
});

describe('formatReachExtremes', () => {
  it('reports a dead zone when there is a genuine gap between groundwave and hop 1', () => {
    const summary = formatReachExtremes([
      { hopCount: 0, minRangeKm: 0, maxRangeKm: 100 },
      { hopCount: 1, minRangeKm: 200, maxRangeKm: 350 },
    ]);
    expect(summary).toBe('groundwave to 100 km, dead to 200 km, first hop 200-350 km');
  });

  it('omits the dead-zone clause when groundwave runs straight into hop 1', () => {
    const summary = formatReachExtremes([
      { hopCount: 0, minRangeKm: 0, maxRangeKm: 100 },
      { hopCount: 1, minRangeKm: 100, maxRangeKm: 350 },
    ]);
    expect(summary).toBe('groundwave to 100 km, first hop 100-350 km');
  });

  it('reports no coverage for an empty extremes list', () => {
    expect(formatReachExtremes([])).toBe('No coverage in this band right now.');
  });
});

describe('rankBandsByMeanReliability', () => {
  it('ranks bands descending by mean reliability over covered cells, ignoring the skip zone', () => {
    const goodBand = fixtureGrid([
      { hopCount: 0, reliability: 0.9 },
      { hopCount: 1, reliability: 0.8 },
      { hopCount: NO_DATA, reliability: 0 }, // must not drag the average down
    ]);
    const mediocreBand = fixtureGrid([
      { hopCount: 0, reliability: 0.3 },
      { hopCount: 1, reliability: 0.2 },
    ]);

    const rankings = rankBandsByMeanReliability(
      new Map([
        ['20m', mediocreBand],
        ['40m', goodBand],
      ]),
    );

    expect(rankings.map((r) => r.bandId)).toEqual(['40m', '20m']);
    expect(rankings[0].meanReliability).toBeCloseTo(0.85, 6);
    expect(rankings[1].meanReliability).toBeCloseTo(0.25, 6);
  });

  it('scores a band with no coverage anywhere as 0 rather than excluding it', () => {
    const emptyBand = fixtureGrid([
      { hopCount: NO_DATA, reliability: 0 },
      { hopCount: NO_DATA, reliability: 0 },
    ]);
    const rankings = rankBandsByMeanReliability(new Map([['160m', emptyBand]]));
    expect(rankings).toEqual([{ bandId: '160m', meanReliability: 0 }]);
  });
});
