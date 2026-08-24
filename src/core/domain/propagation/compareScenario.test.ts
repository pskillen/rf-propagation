import { describe, expect, it } from 'vitest';
import {
  computeCompareDeltas,
  deriveCompareSides,
  DEFAULT_COMPARE_STATE,
  type CompareViewerStateSlice,
} from './compareScenario';
import type { ModeVerdict } from './reliability';

function baseState(): CompareViewerStateSlice {
  return {
    station: { activeAntennaId: 'ant-a' },
    bandId: '40m',
    conditions: { atMs: 1_000 },
    compare: { ...DEFAULT_COMPARE_STATE },
  };
}

describe('deriveCompareSides', () => {
  it('falls back to the left side values when no against* field is set (identical, zero-delta comparison)', () => {
    const { left, right } = deriveCompareSides(baseState());
    expect(left).toEqual({ antennaId: 'ant-a', bandId: '40m', atMs: 1_000 });
    expect(right).toEqual(left);
  });

  it('substitutes exactly the varied antenna field, leaving band/time identical', () => {
    const state = baseState();
    state.compare = { ...DEFAULT_COMPARE_STATE, againstAntennaId: 'ant-b' };
    const { left, right } = deriveCompareSides(state);
    expect(right).toEqual({ antennaId: 'ant-b', bandId: left.bandId, atMs: left.atMs });
  });

  it('substitutes exactly the varied band field, leaving antenna/time identical', () => {
    const state = baseState();
    state.compare = { ...DEFAULT_COMPARE_STATE, againstBandId: '20m' };
    const { left, right } = deriveCompareSides(state);
    expect(right).toEqual({ antennaId: left.antennaId, bandId: '20m', atMs: left.atMs });
  });

  it('substitutes exactly the varied time field, leaving antenna/band identical', () => {
    const state = baseState();
    state.compare = { ...DEFAULT_COMPARE_STATE, againstAtMs: 5_000 };
    const { left, right } = deriveCompareSides(state);
    expect(right).toEqual({ antennaId: left.antennaId, bandId: left.bandId, atMs: 5_000 });
  });
});

describe('computeCompareDeltas', () => {
  it("reproduces worked example C's shape: SSB margin moving from roughly -4dB to +1dB is a positive ~5dB delta", () => {
    // Synthetic fixture matching worked example C (feature-description.md
    // §5): "same dipole at 7m vs 12m ... SSB moves from -4dB to +1dB" --
    // does not need to reproduce the exact figures, just the qualitative
    // sign and rough magnitude.
    const leftVerdicts: ModeVerdict[] = [
      { mode: 'ssb', marginDb: -4, reliability: 0.2, bucket: 'unlikely' },
      { mode: 'cw', marginDb: 3, reliability: 0.6, bucket: 'marginal' },
    ];
    const rightVerdicts: ModeVerdict[] = [
      { mode: 'ssb', marginDb: 1, reliability: 0.55, bucket: 'marginal' },
      { mode: 'cw', marginDb: 8, reliability: 0.85, bucket: 'good' },
    ];

    const deltas = computeCompareDeltas(leftVerdicts, rightVerdicts);
    const ssb = deltas.find((delta) => delta.mode === 'ssb');
    expect(ssb).toBeDefined();
    expect(ssb!.leftMarginDb).toBe(-4);
    expect(ssb!.rightMarginDb).toBe(1);
    expect(ssb!.deltaDb).toBeGreaterThan(0);
    expect(ssb!.deltaDb).toBeCloseTo(5, 0);
  });

  it('pairs deltas by mode only, ignoring modes present on just one side', () => {
    const leftVerdicts: ModeVerdict[] = [
      { mode: 'ssb', marginDb: 0, reliability: 0.5, bucket: 'marginal' },
      { mode: 'ft8', marginDb: 10, reliability: 0.9, bucket: 'good' },
    ];
    const rightVerdicts: ModeVerdict[] = [
      { mode: 'ssb', marginDb: 2, reliability: 0.6, bucket: 'marginal' },
    ];

    const deltas = computeCompareDeltas(leftVerdicts, rightVerdicts);
    expect(deltas).toHaveLength(1);
    expect(deltas[0].mode).toBe('ssb');
    expect(deltas[0].deltaDb).toBe(2);
  });

  it('produces a negative delta when the right side is worse', () => {
    const leftVerdicts: ModeVerdict[] = [
      { mode: 'ssb', marginDb: 5, reliability: 0.8, bucket: 'good' },
    ];
    const rightVerdicts: ModeVerdict[] = [
      { mode: 'ssb', marginDb: -2, reliability: 0.3, bucket: 'unlikely' },
    ];
    const deltas = computeCompareDeltas(leftVerdicts, rightVerdicts);
    expect(deltas[0].deltaDb).toBe(-7);
  });
});
