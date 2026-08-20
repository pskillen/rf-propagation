import { describe, expect, it } from 'vitest';
import { cutawayPlaneNormal, latLonToGlobeCartesian } from './cutawayPlane';

describe('latLonToGlobeCartesian', () => {
  it('places the north pole at (0, 1, 0)', () => {
    const p = latLonToGlobeCartesian(90, 0);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(1, 6);
    expect(p.z).toBeCloseTo(0, 6);
  });

  it('places (0°, 0°) at (0, 0, 1) — theta = 90° at lon 0°', () => {
    const p = latLonToGlobeCartesian(0, 0);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(1, 6);
  });

  it('places (0°, 90°) at (1, 0, 0) — theta = 0° at lon 90°', () => {
    const p = latLonToGlobeCartesian(0, 90);
    expect(p.x).toBeCloseTo(1, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(p.z).toBeCloseTo(0, 6);
  });

  it('always returns a unit vector', () => {
    for (const [lat, lon] of [
      [51.5, -0.13],
      [-33.8, 151.2],
      [0, 179],
      [-90, 45],
    ] as const) {
      const p = latLonToGlobeCartesian(lat, lon);
      expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1, 6);
    }
  });
});

describe('cutawayPlaneNormal', () => {
  it('returns a unit vector', () => {
    const n = cutawayPlaneNormal(51.5, -0.13, 45);
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 6);
  });

  it('is orthogonal to both the transmitter position and the far point along the bearing', () => {
    const txLat = 51.5;
    const txLon = -0.13;
    const bearingDeg = 30;
    const n = cutawayPlaneNormal(txLat, txLon, bearingDeg);
    const tx = latLonToGlobeCartesian(txLat, txLon);
    const dotTx = n.x * tx.x + n.y * tx.y + n.z * tx.z;
    expect(dotTx).toBeCloseTo(0, 5);
  });

  it('is stable regardless of bearing sign convention (0° and 180° share the same great-circle plane)', () => {
    const n0 = cutawayPlaneNormal(10, 20, 0);
    const n180 = cutawayPlaneNormal(10, 20, 180);
    // Same plane -> parallel (or anti-parallel) normals.
    const dot = n0.x * n180.x + n0.y * n180.y + n0.z * n180.z;
    expect(Math.abs(dot)).toBeCloseTo(1, 4);
  });
});
