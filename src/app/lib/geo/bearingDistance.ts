/**
 * Inverse geodesic problem: given two points, what's the distance and
 * initial bearing between them? The reciprocal of
 * `@core/domain/propagation/greatCircle.ts`'s `destinationPoint` (bearing +
 * distance -> point), needed by Reach's Slice 5 (cell-click -> target)
 * to turn a clicked lat/lon back into a bearing/range from the station.
 *
 * App-layer-owned, deliberately NOT added to
 * `src/core/domain/propagation/greatCircle.ts` — this phase's own plan
 * states "this phase adds no engine code and touches nothing under
 * src/core/domain/propagation/." Reach (Slice 5) is the only current
 * consumer; promote into core if a later engine change needs the same
 * inverse-geodesic math for physics purposes rather than UI display.
 *
 * Ported in shape from Codeplug Studio's `geoDistance.ts`
 * (`haversineDistanceM`/`initialBearingDeg`), adapted to this repo's
 * `GeoPoint { latDeg, lonDeg }` / kilometre conventions (matching
 * `destinationPoint`'s own signature and `EARTH_RADIUS_KM`) instead of
 * Studio's separate lat/lon arguments and metres — see this phase's PR
 * description for why (Studio's `GeoPoint` shape doesn't exist here).
 */
import { EARTH_RADIUS_KM } from '@core/domain/propagation/geometry';
import type { GeoPoint } from '@core/domain/propagation/greatCircle';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Great-circle distance (km) between two points, on the same spherical Earth radius `destinationPoint` assumes. */
export function haversineDistanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = (to.latDeg - from.latDeg) * DEG_TO_RAD;
  const dLon = (to.lonDeg - from.lonDeg) * DEG_TO_RAD;
  const lat1 = from.latDeg * DEG_TO_RAD;
  const lat2 = to.latDeg * DEG_TO_RAD;

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Initial bearing (degrees true, 0-360) from `from` to `to`. */
export function initialBearingDeg(from: GeoPoint, to: GeoPoint): number {
  const lat1 = from.latDeg * DEG_TO_RAD;
  const lat2 = to.latDeg * DEG_TO_RAD;
  const dLon = (to.lonDeg - from.lonDeg) * DEG_TO_RAD;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearingDeg = Math.atan2(y, x) * RAD_TO_DEG;
  return (bearingDeg + 360) % 360;
}

const COMPASS_OCTANTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/**
 * One of the 16 compass points nearest `bearingDeg` — ported in shape
 * from Codeplug Studio's `geoDistance.ts`'s `compassOctant`, ADAPTED to
 * this repo's own 8-point set (`bearingDistance.ts` has no existing
 * 16-point table to extend, and Path's own "resolved bearing shown back"
 * requirement, F10.1, doesn't specify 16-point precision — 8 points is
 * legible at a glance, which is the point of showing this at all).
 */
export function compassOctant(bearingDeg: number): string {
  const normalised = ((bearingDeg % 360) + 360) % 360;
  const index = Math.round(normalised / 45) % COMPASS_OCTANTS.length;
  return COMPASS_OCTANTS[index]!;
}

const KM_PER_MI = 1.609344;

/** `"3,238 km (2,012 mi)"` — great-circle distance shown in both units, per F10.1's resolved-target readout. */
export function formatDistanceKmAndMi(km: number): string {
  const mi = km / KM_PER_MI;
  return `${Math.round(km).toLocaleString()} km (${Math.round(mi).toLocaleString()} mi)`;
}

/** `"042°T · NE"` — bearing shown back to the operator, per F10.1's resolved-target readout. */
export function formatBearing(bearingDeg: number): string {
  const normalised = ((bearingDeg % 360) + 360) % 360;
  const padded = String(Math.round(normalised)).padStart(3, '0');
  return `${padded}°T · ${compassOctant(normalised)}`;
}
