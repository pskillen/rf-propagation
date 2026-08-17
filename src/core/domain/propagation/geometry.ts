/**
 * Spherical single-hop geometry for ionospheric reflection.
 *
 * Replaces mk1's flat-Earth model (see mk1-gap-analysis.md §1), which
 * overestimated single-hop range by ~3.5x and left the MUF secant factor
 * unbounded. All angles here are in RADIANS; convert at the API boundary if
 * a caller wants degrees. Distances are in kilometres.
 *
 * Derivation summary (see physics-and-fidelity.md for the full write-up):
 * for a wave launched at takeoff angle Delta from a ground station and
 * reflected at virtual height h' above a spherical Earth of radius Re, the
 * incidence angle phi at the reflection point and the half-hop central
 * angle theta (the great-circle angle, at Earth's centre, between the
 * transmitter and the ground point directly below the reflection point)
 * satisfy:
 *
 *   sin(phi) = Re * cos(Delta) / (Re + h')
 *   theta    = arccos( Re * cos(Delta) / (Re + h') ) - Delta
 *
 * Note arccos(x) = 90 degrees - arcsin(x), so theta = (90 deg - phi) - Delta;
 * the two formulas are mutually consistent, not independent facts.
 */

export const EARTH_RADIUS_KM = 6371;

/**
 * Incidence angle (radians) at a layer of virtual height h', for a wave
 * launched at takeoff angle Delta (radians). This is the angle from the
 * local vertical (zenith) at the reflection point, bounded above by
 * arcsin(Re / (Re + h')) as Delta -> 0 (grazing incidence) — this bound is
 * exactly why sec(phi), the MUF factor, is capped rather than unbounded as
 * in mk1's flat-Earth model.
 */
export function incidenceAngleRad(takeoffAngleRad: number, virtualHeightKm: number): number {
  const x = (EARTH_RADIUS_KM * Math.cos(takeoffAngleRad)) / (EARTH_RADIUS_KM + virtualHeightKm);
  return Math.asin(x);
}

/**
 * Half-hop central angle (radians): the great-circle angle at Earth's
 * centre between the transmitter and the ground point directly below the
 * reflection point. A full hop (up-leg and down-leg) spans 2x this angle.
 */
export function halfHopCentralAngleRad(takeoffAngleRad: number, virtualHeightKm: number): number {
  const x = (EARTH_RADIUS_KM * Math.cos(takeoffAngleRad)) / (EARTH_RADIUS_KM + virtualHeightKm);
  return Math.acos(x) - takeoffAngleRad;
}

/**
 * Ground range (km) covered by a single hop (up-leg + down-leg), i.e.
 * 2 * Re * theta where theta is the half-hop central angle.
 */
export function groundRangePerHopKm(takeoffAngleRad: number, virtualHeightKm: number): number {
  return 2 * EARTH_RADIUS_KM * halfHopCentralAngleRad(takeoffAngleRad, virtualHeightKm);
}

/**
 * Inverse of the geometry above: given a required ground distance D split
 * over n equal hops at virtual height h', what takeoff angle Delta
 * (radians) produces that hop length? Closed form, no iteration — needed by
 * Path mode (a later phase) where distance and hop count are known and
 * Delta is the unknown.
 */
export function takeoffAngleForGroundRangeRad(
  groundRangeKm: number,
  hopCount: number,
  virtualHeightKm: number,
): number {
  const theta = groundRangeKm / (2 * hopCount * EARTH_RADIUS_KM);
  const numerator = Math.cos(theta) - EARTH_RADIUS_KM / (EARTH_RADIUS_KM + virtualHeightKm);
  return Math.atan(numerator / Math.sin(theta));
}

/**
 * Slant path length (km) for ONE HALF HOP (transmitter/receiver to the
 * reflection point, or equivalently the reflection point down to the
 * ground) — not the full hop. Callers computing free-space path loss over
 * a full hop (or a multi-hop path) must sum two of these per hop
 * themselves (up-leg + down-leg); this function does not double it.
 */
export function slantPathLengthKm(takeoffAngleRad: number, virtualHeightKm: number): number {
  const theta = halfHopCentralAngleRad(takeoffAngleRad, virtualHeightKm);
  const re = EARTH_RADIUS_KM;
  const reh = EARTH_RADIUS_KM + virtualHeightKm;
  return Math.sqrt(re * re + reh * reh - 2 * re * reh * Math.cos(theta));
}
