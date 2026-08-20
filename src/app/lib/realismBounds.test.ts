import { describe, expect, it } from 'vitest';
import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import {
  anyInputOutOfRealisticBounds,
  antennaHeightRange,
  clamp,
  frequencyRange,
  isAntennaHeightOutOfRealisticBounds,
  isFrequencyOutOfRealisticBounds,
  isKpOutOfRealisticBounds,
  isSfiOutOfRealisticBounds,
  isTxPowerOutOfRealisticBounds,
  kpRange,
  sfiRange,
  txPowerRange,
} from './realismBounds.ts';

const band40m = UK_AMATEUR_BANDS.find((band) => band.id === '40m')!;

describe('realismBounds', () => {
  it('relaxes each range when unlocked', () => {
    expect(sfiRange(false)).toEqual({ min: 60, max: 300 });
    expect(sfiRange(true)).toEqual({ min: 0, max: 500 });
    expect(kpRange(false)).toEqual({ min: 0, max: 9 });
    expect(kpRange(true)).toEqual({ min: 0, max: 9 });
    expect(antennaHeightRange(false)).toEqual({ min: 1, max: 30 });
    expect(antennaHeightRange(true)).toEqual({ min: 0.5, max: 500 });
    expect(frequencyRange(false, band40m)).toEqual({ min: band40m.minMhz, max: band40m.maxMhz });
    expect(frequencyRange(true, band40m)).toEqual({ min: 1, max: 30 });
    expect(txPowerRange(false)).toEqual({ min: 1, max: 1500 });
    expect(txPowerRange(true)).toEqual({ min: 1, max: 100_000 });
  });

  it('flags a value outside the REALISTIC bound regardless of the toggle', () => {
    expect(isSfiOutOfRealisticBounds(400)).toBe(true);
    expect(isSfiOutOfRealisticBounds(120)).toBe(false);
    expect(isKpOutOfRealisticBounds(10)).toBe(true);
    expect(isAntennaHeightOutOfRealisticBounds(100)).toBe(true);
    expect(isAntennaHeightOutOfRealisticBounds(7)).toBe(false);
    expect(isFrequencyOutOfRealisticBounds(25, band40m)).toBe(true);
    expect(isFrequencyOutOfRealisticBounds(7.1, band40m)).toBe(false);
    expect(isTxPowerOutOfRealisticBounds(5000)).toBe(true);
    expect(isTxPowerOutOfRealisticBounds(100)).toBe(false);
  });

  it('clamps a value into a range', () => {
    expect(clamp(1000, { min: 0, max: 500 })).toBe(500);
    expect(clamp(-5, { min: 0, max: 500 })).toBe(0);
    expect(clamp(120, { min: 0, max: 500 })).toBe(120);
  });

  it('anyInputOutOfRealisticBounds is true when any single input is out of bounds', () => {
    const realistic = {
      sfi: 120,
      kp: 2,
      heightM: 7,
      frequencyMhz: 7.1,
      band: band40m,
      powerW: 100,
    };
    expect(anyInputOutOfRealisticBounds(realistic)).toBe(false);
    expect(anyInputOutOfRealisticBounds({ ...realistic, sfi: 400 })).toBe(true);
    expect(anyInputOutOfRealisticBounds({ ...realistic, powerW: 5000 })).toBe(true);
    expect(anyInputOutOfRealisticBounds({ ...realistic, heightM: 100 })).toBe(true);
  });
});
