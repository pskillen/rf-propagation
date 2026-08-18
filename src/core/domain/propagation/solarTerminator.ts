/**
 * Subsolar point + day/night terminator ring -- ported from Codeplug
 * Studio's `src/core/domain/hfPropagation/solarTerminator.ts` (see this
 * phase's plan file's "Current state" for the reference source), adapted
 * from mk1's `LatLon` (`[lat, lon]` tuple) to this repo's own `GeoPoint`
 * object convention (`greatCircle.ts`) -- the astronomy itself
 * (`solarGeometryAt`, already ported into this repo as
 * `solarZenithAngle.ts`) and the rotate-around-the-sun-axis algorithm are
 * otherwise unchanged.
 *
 * Phase 9 (Globe) reuses this module rather than re-porting the same
 * Studio source a second time -- see this phase's own plan file's
 * "Cross-phase note".
 */
import type { GeoPoint } from './greatCircle';
import { solarGeometryAt } from './solarZenithAngle';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function geoToCartesian(latDeg: number, lonDeg: number): Vec3 {
  const latRad = latDeg * DEG_TO_RAD;
  const lonRad = lonDeg * DEG_TO_RAD;
  const cosLat = Math.cos(latRad);
  return {
    x: cosLat * Math.cos(lonRad),
    y: cosLat * Math.sin(lonRad),
    z: Math.sin(latRad),
  };
}

function cartesianToGeo(v: Vec3): GeoPoint {
  const r = Math.hypot(v.x, v.y, v.z) || 1;
  const latDeg = Math.asin(v.z / r) * RAD_TO_DEG;
  const lonDeg = Math.atan2(v.y, v.x) * RAD_TO_DEG;
  return { latDeg, lonDeg };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: Vec3): Vec3 {
  const r = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / r, y: v.y / r, z: v.z / r };
}

function rotateAroundAxis(v: Vec3, axis: Vec3, angleRad: number): Vec3 {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const c = cross(axis, v);
  const dot = axis.x * v.x + axis.y * v.y + axis.z * v.z;
  const oneMinusCos = 1 - cos;
  return {
    x: v.x * cos + c.x * sin + axis.x * dot * oneMinusCos,
    y: v.y * cos + c.y * sin + axis.y * dot * oneMinusCos,
    z: v.z * cos + c.z * sin + axis.z * dot * oneMinusCos,
  };
}

function perpendicularTo(u: Vec3): Vec3 {
  const helper = Math.abs(u.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  return normalize(cross(u, helper));
}

/** Geographic point where the sun is directly overhead (zenith 0°) at `atMs`. */
export function computeSubsolarPoint(atMs: number): GeoPoint {
  const { subsolarLatDeg, subsolarLonDeg } = solarGeometryAt(atMs);
  return { latDeg: subsolarLatDeg, lonDeg: subsolarLonDeg };
}

/**
 * Samples the day/night terminator as a closed ring of points (solar
 * zenith angle == 90° at every point), for rendering a greyline band.
 * Pure function -- no rendering types, no Leaflet/DOM dependency (see
 * `TerminatorLayer.tsx` for the map-rendering consumer).
 */
export function computeSolarTerminator(atMs: number, pointCount = 180): GeoPoint[] {
  const count = Math.max(8, Math.floor(pointCount));
  const sunPoint = computeSubsolarPoint(atMs);
  const sun = geoToCartesian(sunPoint.latDeg, sunPoint.lonDeg);
  const start = perpendicularTo(sun);
  const points: GeoPoint[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    points.push(cartesianToGeo(rotateAroundAxis(start, sun, angle)));
  }
  const first = points[0];
  if (first) points.push(first);
  return points;
}
