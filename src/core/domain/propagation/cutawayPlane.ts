/**
 * Cutaway-plane geometry for the globe's shell clipping (F6.2, Slice 2) —
 * ported from Codeplug Studio's `src/core/domain/hfPropagation/
 * cutawayPlane.ts` (phase 9's plan file, "Reference-only source"),
 * adapted to this repo's `GeoPoint`/`destinationPoint` convention
 * (`greatCircle.ts`) instead of Studio's separate lat/lon args. Pure
 * geometry, no three.js types here — the globe renderer converts this
 * module's plain vectors into `THREE.Plane`/`THREE.Vector3`.
 */
import { destinationPoint, type GeoPoint } from './greatCircle';

/**
 * Unit vector in the same lat/lon -> Cartesian convention `three-globe`'s
 * own `polar2Cartesian` uses (and the globe renderer's shell/night-shade/
 * sun-marker meshes). Domain math stays free of three.js.
 */
export interface GlobeCartesian {
  x: number;
  y: number;
  z: number;
}

export interface CutawayPlaneNormal {
  /** Unit vector in globe Cartesian space (same convention as {@link latLonToGlobeCartesian}). */
  x: number;
  y: number;
  z: number;
}

/**
 * three-globe `polar2Cartesian` at relative altitude 0, as a unit vector
 * from the globe centre. phi = (90 - lat) deg, theta = (90 - lon) deg. Do
 * not invent a second spherical mapping — every globe mesh builder in this
 * app must agree on this one.
 */
export function latLonToGlobeCartesian(latDeg: number, lonDeg: number): GlobeCartesian {
  const phi = ((90 - latDeg) * Math.PI) / 180;
  const theta = ((90 - lonDeg) * Math.PI) / 180;
  const phiSin = Math.sin(phi);
  return {
    x: phiSin * Math.cos(theta),
    y: Math.cos(phi),
    z: phiSin * Math.sin(theta),
  };
}

function cross(a: GlobeCartesian, b: GlobeCartesian): GlobeCartesian {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalise(v: GlobeCartesian): CutawayPlaneNormal {
  const mag = Math.hypot(v.x, v.y, v.z);
  if (!(mag > 0)) return { x: 1, y: 0, z: 0 };
  return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}

/**
 * Vertical cutaway through the transmitter along `bearingDeg`: the plane
 * contains the transmitter, a point along the bearing, and the globe
 * centre. Normal is the cross product of those two position vectors (from
 * centre), then normalised.
 */
export function cutawayPlaneNormal(
  txLat: number,
  txLon: number,
  bearingDeg: number,
): CutawayPlaneNormal {
  const origin: GeoPoint = { latDeg: txLat, lonDeg: txLon };
  const farPoint = destinationPoint(origin, bearingDeg, 1_000_000);
  const tx = latLonToGlobeCartesian(txLat, txLon);
  const far = latLonToGlobeCartesian(farPoint.latDeg, farPoint.lonDeg);
  return normalise(cross(tx, far));
}
