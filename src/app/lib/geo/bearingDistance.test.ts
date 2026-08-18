import { describe, expect, it } from 'vitest';
import { destinationPoint, type GeoPoint } from '@core/domain/propagation/greatCircle';
import { haversineDistanceKm, initialBearingDeg } from './bearingDistance.ts';

const LONDON: GeoPoint = { latDeg: 51.5074, lonDeg: -0.1278 };

describe('haversineDistanceKm / initialBearingDeg', () => {
  it('round-trips against destinationPoint for a range of bearings/distances', () => {
    const cases: Array<{ bearingDeg: number; distanceKm: number }> = [
      { bearingDeg: 0, distanceKm: 500 },
      { bearingDeg: 45, distanceKm: 1200 },
      { bearingDeg: 90, distanceKm: 3000 },
      { bearingDeg: 180, distanceKm: 800 },
      { bearingDeg: 270, distanceKm: 2500 },
      { bearingDeg: 315, distanceKm: 6000 },
    ];

    for (const { bearingDeg, distanceKm } of cases) {
      const destination = destinationPoint(LONDON, bearingDeg, distanceKm);
      expect(haversineDistanceKm(LONDON, destination)).toBeCloseTo(distanceKm, 3);
      expect(initialBearingDeg(LONDON, destination)).toBeCloseTo(bearingDeg, 3);
    }
  });

  it('returns 0 distance and a defined bearing for coincident points', () => {
    expect(haversineDistanceKm(LONDON, LONDON)).toBeCloseTo(0, 6);
    expect(Number.isFinite(initialBearingDeg(LONDON, LONDON))).toBe(true);
  });

  it('initialBearingDeg is always in [0, 360)', () => {
    const north: GeoPoint = { latDeg: LONDON.latDeg + 1, lonDeg: LONDON.lonDeg };
    const south: GeoPoint = { latDeg: LONDON.latDeg - 1, lonDeg: LONDON.lonDeg };
    expect(initialBearingDeg(LONDON, north)).toBeGreaterThanOrEqual(0);
    expect(initialBearingDeg(LONDON, north)).toBeLessThan(360);
    expect(initialBearingDeg(LONDON, south)).toBeCloseTo(180, 3);
  });
});
