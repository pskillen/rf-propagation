/**
 * Sanity checks for greatCircle.ts's destination-point formula -- this is
 * standard great-circle navigation math (not a physics claim this phase
 * makes), so these are basic correctness checks, not numbered V-checks.
 */
import { describe, expect, it } from 'vitest';
import { EARTH_RADIUS_KM } from './geometry';
import { destinationPoint } from './greatCircle';

describe('destinationPoint', () => {
  it('travelling zero distance returns the origin', () => {
    const p = destinationPoint({ latDeg: 51.5, lonDeg: -0.1 }, 45, 0);
    expect(p.latDeg).toBeCloseTo(51.5, 6);
    expect(p.lonDeg).toBeCloseTo(-0.1, 6);
  });

  it('travelling due north from the equator increases latitude by the angular distance', () => {
    const quarterCircumferenceKm = (Math.PI / 2) * EARTH_RADIUS_KM;
    const p = destinationPoint({ latDeg: 0, lonDeg: 0 }, 0, quarterCircumferenceKm);
    expect(p.latDeg).toBeCloseTo(90, 3);
  });

  it('travelling due east along the equator a quarter circumference reaches lon 90', () => {
    const quarterCircumferenceKm = (Math.PI / 2) * EARTH_RADIUS_KM;
    const p = destinationPoint({ latDeg: 0, lonDeg: 0 }, 90, quarterCircumferenceKm);
    expect(p.latDeg).toBeCloseTo(0, 3);
    expect(p.lonDeg).toBeCloseTo(90, 3);
  });

  it('travelling a half circumference due east crosses the antimeridian to lon 180', () => {
    const halfCircumferenceKm = Math.PI * EARTH_RADIUS_KM;
    const p = destinationPoint({ latDeg: 0, lonDeg: 0 }, 90, halfCircumferenceKm);
    expect(Math.abs(p.lonDeg)).toBeCloseTo(180, 2);
  });

  it('travelling due south from the north pole always reaches the same latitude regardless of bearing', () => {
    const distanceKm = 1000;
    const a = destinationPoint({ latDeg: 90, lonDeg: 0 }, 0, distanceKm);
    const b = destinationPoint({ latDeg: 90, lonDeg: 0 }, 137, distanceKm);
    expect(a.latDeg).toBeCloseTo(b.latDeg, 6);
  });
});
