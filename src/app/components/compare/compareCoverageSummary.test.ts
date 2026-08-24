import { describe, expect, it } from 'vitest';
import type { ReachExtreme } from '../reach/reachSummary.ts';
import { computeCoverageReachDelta } from './compareCoverageSummary.ts';

describe('computeCoverageReachDelta', () => {
  it('reports a positive groundwave/first-hop delta when the right side reaches further (worked example C shape)', () => {
    const left: ReachExtreme[] = [
      { hopCount: 0, minRangeKm: 0, maxRangeKm: 40 },
      { hopCount: 1, minRangeKm: 900, maxRangeKm: 1800 },
    ];
    const right: ReachExtreme[] = [
      { hopCount: 0, minRangeKm: 0, maxRangeKm: 55 },
      { hopCount: 1, minRangeKm: 800, maxRangeKm: 2000 },
    ];

    const delta = computeCoverageReachDelta(left, right);
    expect(delta.groundwaveMaxKmLeft).toBe(40);
    expect(delta.groundwaveMaxKmRight).toBe(55);
    expect(delta.groundwaveMaxKmDeltaKm).toBe(15);
    expect(delta.firstHopMinKmLeft).toBe(900);
    expect(delta.firstHopMinKmRight).toBe(800);
    expect(delta.firstHopMinKmDeltaKm).toBe(-100);
  });

  it('returns null deltas when a side has no coverage at all in a category', () => {
    const left: ReachExtreme[] = [];
    const right: ReachExtreme[] = [{ hopCount: 0, minRangeKm: 0, maxRangeKm: 30 }];

    const delta = computeCoverageReachDelta(left, right);
    expect(delta.groundwaveMaxKmLeft).toBeNull();
    expect(delta.groundwaveMaxKmRight).toBe(30);
    expect(delta.groundwaveMaxKmDeltaKm).toBeNull();
    expect(delta.firstHopMinKmDeltaKm).toBeNull();
  });

  it('is zero when both sides are identical (no comparison configured)', () => {
    const extremes: ReachExtreme[] = [
      { hopCount: 0, minRangeKm: 0, maxRangeKm: 40 },
      { hopCount: 1, minRangeKm: 900, maxRangeKm: 1800 },
    ];
    const delta = computeCoverageReachDelta(extremes, extremes);
    expect(delta.groundwaveMaxKmDeltaKm).toBe(0);
    expect(delta.firstHopMinKmDeltaKm).toBe(0);
  });
});
