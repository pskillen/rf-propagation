import { describe, expect, it } from 'vitest';
import {
  freeSpaceSpreadingLossDb,
  groundReflectionLossDb,
  ionosphericAbsorptionDbPerHop,
  POLARISATION_LOSS_DB,
  ssnFromSfi,
} from './losses';

describe('freeSpaceSpreadingLossDb', () => {
  it('scales as 20dB per decade of distance', () => {
    const at100 = freeSpaceSpreadingLossDb(100, 14);
    const at1000 = freeSpaceSpreadingLossDb(1000, 14);
    expect(at1000 - at100).toBeCloseTo(20, 5);
  });

  it('scales as 20dB per decade of frequency', () => {
    const at1MHz = freeSpaceSpreadingLossDb(1000, 1);
    const at10MHz = freeSpaceSpreadingLossDb(1000, 10);
    expect(at10MHz - at1MHz).toBeCloseTo(20, 5);
  });
});

describe('ssnFromSfi', () => {
  it('matches the stated conversion', () => {
    expect(ssnFromSfi(120)).toBeCloseTo((120 - 63.75) / 0.728, 9);
  });
});

describe('ionosphericAbsorptionDbPerHop', () => {
  const phiD45deg = (45 * Math.PI) / 180;

  it('clamps to exactly zero once solar zenith reaches 90deg (no D layer at night)', () => {
    expect(ionosphericAbsorptionDbPerHop(phiD45deg, 80, 90, 14)).toBe(0);
    expect(ionosphericAbsorptionDbPerHop(phiD45deg, 80, 120, 14)).toBe(0);
    expect(ionosphericAbsorptionDbPerHop(phiD45deg, 80, 179, 14)).toBe(0);
  });

  it('is strictly positive just before the 90deg clamp', () => {
    expect(ionosphericAbsorptionDbPerHop(phiD45deg, 80, 89.9, 14)).toBeGreaterThan(0);
  });

  it('never goes negative or NaN across a full daytime zenith sweep', () => {
    for (let chi = 0; chi < 90; chi += 5) {
      const value = ionosphericAbsorptionDbPerHop(phiD45deg, 80, chi, 14);
      expect(Number.isNaN(value)).toBe(false);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('decreases as frequency rises (absorption falls off with frequency)', () => {
    const low = ionosphericAbsorptionDbPerHop(phiD45deg, 80, 0, 3.5);
    const high = ionosphericAbsorptionDbPerHop(phiD45deg, 80, 0, 28);
    expect(high).toBeLessThan(low);
  });
});

describe('groundReflectionLossDb', () => {
  it('is zero for a single hop (no intermediate bounce)', () => {
    expect(groundReflectionLossDb('land', 0)).toBe(0);
  });

  it('sea path measurably outperforms land path at equal bounce count', () => {
    const sea = groundReflectionLossDb('sea', 2);
    const land = groundReflectionLossDb('land', 2);
    expect(sea).toBeLessThan(land);
  });

  it('mixed sits exactly between sea and land, per bounce', () => {
    expect(groundReflectionLossDb('mixed', 1)).toBeCloseTo(
      (groundReflectionLossDb('sea', 1) + groundReflectionLossDb('land', 1)) / 2,
      9,
    );
  });

  it('scales linearly with intermediate bounce count', () => {
    expect(groundReflectionLossDb('land', 3)).toBeCloseTo(3 * groundReflectionLossDb('land', 1), 9);
  });
});

describe('POLARISATION_LOSS_DB', () => {
  it('is 3dB, applied once per path (not exported as per-hop)', () => {
    expect(POLARISATION_LOSS_DB).toBe(3);
  });
});
