import { describe, expect, it } from 'vitest';
import { bandFromFrequencyMhz, isAmateurBand, UK_AMATEUR_BANDS } from './bandCatalog.ts';

const EXPECTED_BANDS: Array<{ id: string; minMhz: number; maxMhz: number }> = [
  { id: '160m', minMhz: 1.81, maxMhz: 2.0 },
  { id: '80m', minMhz: 3.5, maxMhz: 3.8 },
  { id: '60m', minMhz: 5.2585, maxMhz: 5.4065 },
  { id: '40m', minMhz: 7.0, maxMhz: 7.2 },
  { id: '30m', minMhz: 10.1, maxMhz: 10.15 },
  { id: '20m', minMhz: 14.0, maxMhz: 14.35 },
  { id: '17m', minMhz: 18.068, maxMhz: 18.168 },
  { id: '15m', minMhz: 21.0, maxMhz: 21.45 },
  { id: '12m', minMhz: 24.89, maxMhz: 24.99 },
  { id: '10m', minMhz: 28.0, maxMhz: 29.7 },
];

describe('UK_AMATEUR_BANDS', () => {
  it('has exactly the ten expected amateur HF band ids, in order', () => {
    expect(UK_AMATEUR_BANDS.map((b) => b.id)).toEqual(EXPECTED_BANDS.map((b) => b.id));
  });

  it.each(EXPECTED_BANDS)('$id has the correct minMhz/maxMhz range', ({ id, minMhz, maxMhz }) => {
    const band = UK_AMATEUR_BANDS.find((b) => b.id === id);
    expect(band?.minMhz).toBe(minMhz);
    expect(band?.maxMhz).toBe(maxMhz);
  });

  it('excludes 136khz/600m (sub-MF/LF) and 6m+ (VHF) — HF amateur bands only', () => {
    const ids = UK_AMATEUR_BANDS.map((b) => b.id);
    expect(ids).not.toContain('136khz');
    expect(ids).not.toContain('600m');
    expect(ids).not.toContain('6m');
    expect(ids).not.toContain('2m');
  });

  it('every band is category amateur', () => {
    expect(UK_AMATEUR_BANDS.every(isAmateurBand)).toBe(true);
  });
});

describe('bandFromFrequencyMhz', () => {
  it.each(EXPECTED_BANDS)(
    'round-trips a frequency inside $id back to its id',
    ({ id, minMhz, maxMhz }) => {
      const midpoint = (minMhz + maxMhz) / 2;
      expect(bandFromFrequencyMhz(midpoint)?.id).toBe(id);
      expect(bandFromFrequencyMhz(minMhz)?.id).toBe(id);
      expect(bandFromFrequencyMhz(maxMhz)?.id).toBe(id);
    },
  );

  it('returns null for a frequency in a gap between bands', () => {
    expect(bandFromFrequencyMhz(2.5)).toBeNull(); // between 160m and 80m
  });

  it('returns null for a non-finite or non-positive frequency', () => {
    expect(bandFromFrequencyMhz(NaN)).toBeNull();
    expect(bandFromFrequencyMhz(0)).toBeNull();
    expect(bandFromFrequencyMhz(-14)).toBeNull();
  });
});
