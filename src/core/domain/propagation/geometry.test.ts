import { describe, expect, it } from 'vitest';
import {
  EARTH_RADIUS_KM,
  groundRangePerHopKm,
  halfHopCentralAngleRad,
  incidenceAngleRad,
  slantPathLengthKm,
  takeoffAngleForGroundRangeRad,
} from './geometry';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

describe('geometry primitives', () => {
  it('exposes Earth radius as 6371 km', () => {
    expect(EARTH_RADIUS_KM).toBe(6371);
  });

  describe('worked example: Delta=3deg, h`=300km', () => {
    // The phase plan's prose worked example rounds Delta=2.93deg to "3deg" when
    // stating theta=14.56deg for the forward direction; computed precisely from
    // Delta=3.00deg exactly, theta is ~14.4993deg (verified against the same
    // formula independently). The round-trip pair (theta=14.56deg -> Delta=2.93deg,
    // tested below) is the one that is exactly self-consistent, and is what V5
    // actually exercises. See PR description for this note.
    it('produces incidence angle phi ~= 72.50deg', () => {
      const phiDeg = incidenceAngleRad(3 * DEG_TO_RAD, 300) * RAD_TO_DEG;
      expect(phiDeg).toBeCloseTo(72.5007, 3);
    });

    it('produces half-hop central angle theta ~= 14.50deg', () => {
      const thetaDeg = halfHopCentralAngleRad(3 * DEG_TO_RAD, 300) * RAD_TO_DEG;
      expect(thetaDeg).toBeCloseTo(14.4993, 3);
    });

    it('inverting theta=14.56deg (n=1 hop) returns Delta ~= 2.93deg', () => {
      const thetaRad = 14.56 * DEG_TO_RAD;
      const groundRangeKm = 2 * EARTH_RADIUS_KM * thetaRad;
      const deltaDeg = takeoffAngleForGroundRangeRad(groundRangeKm, 1, 300) * RAD_TO_DEG;
      expect(deltaDeg).toBeCloseTo(2.93, 2);
    });
  });

  describe('round-trip consistency (V5 domain)', () => {
    it('Delta -> theta -> Delta round-trips to within 0.05deg across [1deg, 89deg]', () => {
      for (let deltaDeg = 1; deltaDeg <= 89; deltaDeg += 0.5) {
        const deltaRad = deltaDeg * DEG_TO_RAD;
        const theta = halfHopCentralAngleRad(deltaRad, 300);
        const groundRangeKm = 2 * EARTH_RADIUS_KM * theta;
        const recoveredDeg = takeoffAngleForGroundRangeRad(groundRangeKm, 1, 300) * RAD_TO_DEG;
        expect(Math.abs(recoveredDeg - deltaDeg)).toBeLessThan(0.05);
      }
    });

    it('round-trips at grazing (Delta->0deg) and near-vertical (Delta->90deg) extremes', () => {
      for (const deltaDeg of [0.01, 0.1, 89.9, 89.99]) {
        const deltaRad = deltaDeg * DEG_TO_RAD;
        const theta = halfHopCentralAngleRad(deltaRad, 300);
        const groundRangeKm = 2 * EARTH_RADIUS_KM * theta;
        const recoveredDeg = takeoffAngleForGroundRangeRad(groundRangeKm, 1, 300) * RAD_TO_DEG;
        expect(Math.abs(recoveredDeg - deltaDeg)).toBeLessThan(0.05);
      }
    });
  });

  describe('ground range', () => {
    it('equals 2 * Re * theta', () => {
      const deltaRad = 10 * DEG_TO_RAD;
      const theta = halfHopCentralAngleRad(deltaRad, 300);
      expect(groundRangePerHopKm(deltaRad, 300)).toBeCloseTo(2 * EARTH_RADIUS_KM * theta, 9);
    });

    it('decreases as takeoff angle increases (steeper launch, shorter hop)', () => {
      const low = groundRangePerHopKm(5 * DEG_TO_RAD, 300);
      const high = groundRangePerHopKm(45 * DEG_TO_RAD, 300);
      expect(high).toBeLessThan(low);
    });
  });

  describe('slant path length', () => {
    it('is a single half-hop, not a doubled full hop', () => {
      // At near-vertical incidence the half-hop slant path should approach
      // the virtual height itself (straight up), not twice it.
      const halfHop = slantPathLengthKm(89.99 * DEG_TO_RAD, 300);
      expect(halfHop).toBeCloseTo(300, 0);
    });

    it('is always at least the virtual height (slant >= vertical distance)', () => {
      for (const deltaDeg of [1, 10, 30, 60, 89]) {
        expect(slantPathLengthKm(deltaDeg * DEG_TO_RAD, 300)).toBeGreaterThanOrEqual(300);
      }
    });
  });

  describe('extremes', () => {
    it('handles near-vertical Delta -> 90deg without NaN', () => {
      const deltaRad = 89.999 * DEG_TO_RAD;
      expect(Number.isNaN(incidenceAngleRad(deltaRad, 300))).toBe(false);
      expect(Number.isNaN(halfHopCentralAngleRad(deltaRad, 300))).toBe(false);
    });

    it('handles grazing Delta -> 0deg without NaN, and phi approaches its max', () => {
      const deltaRad = 0.001 * DEG_TO_RAD;
      const phiDeg = incidenceAngleRad(deltaRad, 300) * RAD_TO_DEG;
      expect(Number.isNaN(phiDeg)).toBe(false);
      // max possible phi at h'=300km is arcsin(Re/(Re+h')) ~= 72.75deg
      expect(phiDeg).toBeLessThan(72.8);
      expect(phiDeg).toBeGreaterThan(72.4);
    });
  });
});
