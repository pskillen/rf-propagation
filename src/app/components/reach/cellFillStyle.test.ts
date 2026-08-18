import { describe, expect, it } from 'vitest';
import { cellFillStyle, COVERAGE_NO_DATA, HOP_BAND_COLORS } from './cellFillStyle.ts';

describe('cellFillStyle', () => {
  it('returns null (zero fill) for the skip-zone sentinel, regardless of reliability', () => {
    expect(cellFillStyle(COVERAGE_NO_DATA, 0)).toBeNull();
    expect(cellFillStyle(COVERAGE_NO_DATA, 1)).toBeNull();
  });

  it.each([0, 1, 2, 3, 4])('uses the correct hue for hopCount=%d', (hopCount) => {
    const style = cellFillStyle(hopCount, 0.5);
    expect(style?.color).toBe(HOP_BAND_COLORS[hopCount]);
  });

  it('scales opacity as 0.15 + 0.65 * reliability', () => {
    expect(cellFillStyle(0, 0)?.opacity).toBeCloseTo(0.15, 6);
    expect(cellFillStyle(0, 1)?.opacity).toBeCloseTo(0.8, 6);
    expect(cellFillStyle(0, 0.5)?.opacity).toBeCloseTo(0.475, 6);
  });

  it('clamps out-of-range reliability into [0,1] rather than producing an out-of-range opacity', () => {
    expect(cellFillStyle(1, -5)?.opacity).toBeCloseTo(0.15, 6);
    expect(cellFillStyle(1, 5)?.opacity).toBeCloseTo(0.8, 6);
  });

  it('a low-but-nonzero reliability cell is still faintly visible, distinct from no-coverage', () => {
    const style = cellFillStyle(2, 0.01);
    expect(style).not.toBeNull();
    expect(style?.opacity).toBeGreaterThan(0.15);
  });

  it('clamps an unexpected hopCount above 4 to hop 4s colour rather than being undefined', () => {
    expect(cellFillStyle(7, 0.5)?.color).toBe(HOP_BAND_COLORS[4]);
  });
});
