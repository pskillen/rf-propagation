import { describe, expect, it } from 'vitest';
import { MODE_THRESHOLD_DB_2400HZ, modeMarginDb } from './modes';

describe('modeMarginDb', () => {
  it('is snr - threshold for every mode', () => {
    for (const mode of ['ssb', 'cw', 'ft8', 'wspr'] as const) {
      expect(modeMarginDb(0, mode)).toBeCloseTo(-MODE_THRESHOLD_DB_2400HZ[mode], 9);
    }
  });

  it('FT8 works at SNRs where SSB does not, by roughly the published 27dB gap', () => {
    // SSB threshold 6dB, FT8 threshold -21dB -> 27dB gap.
    expect(MODE_THRESHOLD_DB_2400HZ.ssb - MODE_THRESHOLD_DB_2400HZ.ft8).toBe(27);

    const snr = -10; // below SSB's threshold, above FT8's
    expect(modeMarginDb(snr, 'ssb')).toBeLessThan(0);
    expect(modeMarginDb(snr, 'ft8')).toBeGreaterThan(0);
  });

  it('orders thresholds ssb > cw > ft8 > wspr (weakest-signal modes need less SNR)', () => {
    expect(MODE_THRESHOLD_DB_2400HZ.ssb).toBeGreaterThan(MODE_THRESHOLD_DB_2400HZ.cw);
    expect(MODE_THRESHOLD_DB_2400HZ.cw).toBeGreaterThan(MODE_THRESHOLD_DB_2400HZ.ft8);
    expect(MODE_THRESHOLD_DB_2400HZ.ft8).toBeGreaterThan(MODE_THRESHOLD_DB_2400HZ.wspr);
  });
});
