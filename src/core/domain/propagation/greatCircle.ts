/**
 * Great-circle navigation on a spherical Earth: given an origin point, a
 * bearing and a distance, where do you end up? This is a DIFFERENT concern
 * from geometry.ts's single-hop reflection geometry (incidence angle,
 * half-hop central angle, ground range for ONE hop) -- this module walks
 * along the Earth's surface in a straight (great-circle) line, which is
 * what phase 4 needs to find the geographic midpoint of each hop (for
 * spatially-varying solar zenith angle, coverageGrid.ts) and each ray
 * point's lat/lon (for illustrationRays.ts's globe-ready polylines).
 *
 * Standard spherical "destination point given distance and bearing"
 * formula (see e.g. Movable Type's aviation-formulary write-up); not
 * specific to this product, just standard great-circle navigation math.
 */

import { EARTH_RADIUS_KM } from './geometry';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export interface GeoPoint {
  latDeg: number;
  lonDeg: number;
}

/** Normalises a longitude to (-180, 180]. */
function normaliseLonDeg(lonDeg: number): number {
  let lon = lonDeg;
  while (lon > 180) lon -= 360;
  while (lon <= -180) lon += 360;
  return lon;
}

/**
 * Destination point reached by travelling `distanceKm` along `bearingDeg`
 * (0deg = north, clockwise) from `origin`, on a spherical Earth of radius
 * `EARTH_RADIUS_KM`. Distance is not bounded here (a caller can legitimately
 * ask for a point past the antipode); this is pure navigation, not a
 * propagation-reachability claim.
 */
export function destinationPoint(
  origin: GeoPoint,
  bearingDeg: number,
  distanceKm: number,
): GeoPoint {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const lat1 = origin.latDeg * DEG_TO_RAD;
  const lon1 = origin.lonDeg * DEG_TO_RAD;
  const bearing = bearingDeg * DEG_TO_RAD;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngularDistance = Math.sin(angularDistance);
  const cosAngularDistance = Math.cos(angularDistance);

  const sinLat2 = sinLat1 * cosAngularDistance + cosLat1 * sinAngularDistance * Math.cos(bearing);
  const lat2 = Math.asin(Math.max(-1, Math.min(1, sinLat2)));

  const y = Math.sin(bearing) * sinAngularDistance * cosLat1;
  const x = cosAngularDistance - sinLat1 * sinLat2;
  const lon2 = lon1 + Math.atan2(y, x);

  return {
    latDeg: lat2 * RAD_TO_DEG,
    lonDeg: normaliseLonDeg(lon2 * RAD_TO_DEG),
  };
}
