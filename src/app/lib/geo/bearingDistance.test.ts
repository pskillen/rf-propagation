import { describe, expect, it } from 'vitest';
import { destinationPoint, type GeoPoint } from '@core/domain/propagation/greatCircle';
import {
  compassOctant,
  formatBearing,
  formatDistanceKmAndMi,
  haversineDistanceKm,
  initialBearingDeg,
} from './bearingDistance.ts';

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

describe('compassOctant', () => {
  it('maps cardinal and intercardinal bearings to the nearest of 8 points', () => {
    expect(compassOctant(0)).toBe('N');
    expect(compassOctant(45)).toBe('NE');
    expect(compassOctant(90)).toBe('E');
    expect(compassOctant(135)).toBe('SE');
    expect(compassOctant(180)).toBe('S');
    expect(compassOctant(225)).toBe('SW');
    expect(compassOctant(270)).toBe('W');
    expect(compassOctant(315)).toBe('NW');
  });

  it('wraps a bearing just under 360 back to N', () => {
    expect(compassOctant(359)).toBe('N');
  });
});

describe('formatDistanceKmAndMi', () => {
  it('formats km and mi with thousands separators', () => {
    expect(formatDistanceKmAndMi(3238)).toBe('3,238 km (2,012 mi)');
  });
});

describe('formatBearing', () => {
  it('pads to three digits and appends the compass point', () => {
    expect(formatBearing(42)).toBe('042°T · NE');
    expect(formatBearing(0)).toBe('000°T · N');
  });
});
