import { describe, expect, it } from 'vitest';
import { noiseFloorDbm } from './noise';

describe('noiseFloorDbm', () => {
  it('quiet rural is meaningfully quieter than urban at equal frequency', () => {
    const urban = noiseFloorDbm(14, 'urban', 2400);
    const quietRural = noiseFloorDbm(14, 'quietRural', 2400);
    expect(quietRural).toBeLessThan(urban - 10);
  });

  it('orders all four environments as urban >= residential >= rural >= quietRural at 14MHz', () => {
    const urban = noiseFloorDbm(14, 'urban', 2400);
    const residential = noiseFloorDbm(14, 'residential', 2400);
    const rural = noiseFloorDbm(14, 'rural', 2400);
    const quietRural = noiseFloorDbm(14, 'quietRural', 2400);
    expect(urban).toBeGreaterThanOrEqual(residential);
    expect(residential).toBeGreaterThanOrEqual(rural);
    expect(rural).toBeGreaterThanOrEqual(quietRural);
  });

  it('bandwidth doubling raises the floor by ~3dB (10*log10(2))', () => {
    const at2400 = noiseFloorDbm(14, 'rural', 2400);
    const at4800 = noiseFloorDbm(14, 'rural', 4800);
    expect(at4800 - at2400).toBeCloseTo(10 * Math.log10(2), 5);
  });

  it('falls back to the galactic floor once man-made noise drops below it (high frequency)', () => {
    // At high enough frequency, the steeper man-made rolloff (d ~ 27-29)
    // drops below the shallower galactic rolloff (d = 23), so quiet rural's
    // floor should approach the galactic-noise value, not go arbitrarily low.
    const value = noiseFloorDbm(30, 'quietRural', 2400);
    const galacticOnly = -174 + (52 - 23 * Math.log10(30)) + 10 * Math.log10(2400);
    expect(value).toBeCloseTo(galacticOnly, 5);
  });
});
