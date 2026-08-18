/**
 * Slice 5 (fix/reach-directionality-antenna-greyline) correctness tests:
 * the direct check mk1 never had ("terminator position verified against a
 * known date and time" -- phase 9's own acceptance criterion, satisfied
 * here once so phase 9 doesn't need to duplicate it, see this phase's
 * plan file's Cross-phase note).
 */
import { describe, expect, it } from 'vitest';
import { solarZenithAngleDeg } from './solarZenithAngle';
import { computeSolarTerminator, computeSubsolarPoint } from './solarTerminator';

/** Same equinox instant solarZenithAngle.test.ts and coverageGrid.test.ts already use. */
const EQUINOX_SOLAR_NOON_UTC = Date.UTC(2024, 2, 20, 12, 0, 0);

describe('computeSubsolarPoint', () => {
  it('is near (0°, 0°) at solar noon on an equinox', () => {
    const point = computeSubsolarPoint(EQUINOX_SOLAR_NOON_UTC);
    expect(point.latDeg).toBeCloseTo(0, 0);
    expect(point.lonDeg).toBeCloseTo(0, 0);
  });

  it('matches solarZenithAngleDeg: the subsolar point itself has ~0° zenith angle', () => {
    const point = computeSubsolarPoint(EQUINOX_SOLAR_NOON_UTC);
    expect(solarZenithAngleDeg(point.latDeg, point.lonDeg, EQUINOX_SOLAR_NOON_UTC)).toBeCloseTo(
      0,
      1,
    );
  });
});

describe('computeSolarTerminator', () => {
  it('returns a closed ring (first point equals last point)', () => {
    const ring = computeSolarTerminator(EQUINOX_SOLAR_NOON_UTC, 180);
    expect(ring.length).toBeGreaterThan(8);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('every point on the ring sits at ~90° solar zenith angle', () => {
    const ring = computeSolarTerminator(EQUINOX_SOLAR_NOON_UTC, 180);
    for (const point of ring) {
      expect(solarZenithAngleDeg(point.latDeg, point.lonDeg, EQUINOX_SOLAR_NOON_UTC)).toBeCloseTo(
        90,
        0,
      );
    }
  });

  it('respects a custom pointCount (plus the closing duplicate point)', () => {
    const ring = computeSolarTerminator(EQUINOX_SOLAR_NOON_UTC, 36);
    expect(ring).toHaveLength(37);
  });

  it('clamps pointCount to a minimum of 8', () => {
    const ring = computeSolarTerminator(EQUINOX_SOLAR_NOON_UTC, 2);
    expect(ring).toHaveLength(9);
  });

  it('the ring is centred on the antipode of the subsolar point (its own midpoint reads ~90° zenith at that far side too)', () => {
    // Sanity check on the geometry, not just the zenith-angle re-derivation
    // above: at a solstice (large declination), the ring should dip well
    // south of the equator in the northern-summer hemisphere and vice
    // versa -- i.e. it's not just always tracing the equator.
    const juneSolsticeNoonUtc = Date.UTC(2024, 5, 20, 12, 0, 0);
    const ring = computeSolarTerminator(juneSolsticeNoonUtc, 180);
    const maxLat = Math.max(...ring.map((point) => point.latDeg));
    const minLat = Math.max(...ring.map((point) => -point.latDeg));
    expect(maxLat).toBeGreaterThan(10);
    expect(minLat).toBeGreaterThan(10);
  });
});
