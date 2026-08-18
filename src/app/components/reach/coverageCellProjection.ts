/**
 * Cell <-> geographic-coordinate projection (Slice 2, F5.2) — the one place
 * this phase converts a `CoverageGridResult` cell index into lat/lon (and,
 * for Slice 5's cell-click target, back again). Cell `(azimuthIndex,
 * rangeBin)` has centre bearing `azimuthIndex * (360 / azimuthCount)`
 * degrees true and centre range `rangeBin * rangeBinKm + rangeBinKm / 2`
 * km from the station — converted with the engine's own `destinationPoint`
 * great-circle formula (not a flat approximation), so the shading never
 * visibly drifts from the true coverage geometry near the poles/date line.
 */
import { destinationPoint, type GeoPoint } from '@core/domain/propagation/greatCircle';
import { haversineDistanceKm, initialBearingDeg } from '../../lib/geo/bearingDistance.ts';

export interface CellGridShape {
  azimuthCount: number;
  rangeBinCount: number;
  rangeBinKm: number;
}

/** Cell (azimuthIndex, rangeBin) -> its centre point, `azimuthCount`/`rangeBinKm` from a `CoverageGridResult` (or fixture of the same shape). */
export function cellCentre(
  station: GeoPoint,
  shape: CellGridShape,
  azimuthIndex: number,
  rangeBin: number,
): GeoPoint {
  const bearingDeg = azimuthIndex * (360 / shape.azimuthCount);
  const rangeKm = rangeBin * shape.rangeBinKm + shape.rangeBinKm / 2;
  return destinationPoint(station, bearingDeg, rangeKm);
}

/** The four corners of cell (azimuthIndex, rangeBin)'s annular sector, station-centred — used by `CoverageCanvasLayer` to fill an approximating quad per cell. */
export function cellCorners(
  station: GeoPoint,
  shape: CellGridShape,
  azimuthIndex: number,
  rangeBin: number,
): [GeoPoint, GeoPoint, GeoPoint, GeoPoint] {
  const azimuthStepDeg = 360 / shape.azimuthCount;
  const bearingStartDeg = azimuthIndex * azimuthStepDeg;
  const bearingEndDeg = bearingStartDeg + azimuthStepDeg;
  const rangeStartKm = rangeBin * shape.rangeBinKm;
  const rangeEndKm = rangeStartKm + shape.rangeBinKm;

  return [
    destinationPoint(station, bearingStartDeg, rangeStartKm),
    destinationPoint(station, bearingEndDeg, rangeStartKm),
    destinationPoint(station, bearingEndDeg, rangeEndKm),
    destinationPoint(station, bearingStartDeg, rangeEndKm),
  ];
}

export interface CellCoordinate {
  azimuthIndex: number;
  rangeBin: number;
  bearingDeg: number;
  rangeKm: number;
}

/**
 * Inverts `cellCentre`: given a clicked/tapped lat/lon, which cell is it
 * in, and what's the bearing/range from the station (Slice 5's target
 * math)? `rangeBin` is not clamped to `rangeBinCount` — a click far
 * outside the grid's modelled extent still returns a (large) bin index,
 * left to the caller to treat as "outside the grid" if it needs to.
 */
// Guards the boundary bin/azimuth-index computation below against
// floating-point noise from the destinationPoint -> initialBearingDeg
// round trip (e.g. a point built at EXACTLY a cell's edge bearing can come
// back as 4.999999999999deg instead of 5deg, which would floor into the
// wrong azimuth index) — far smaller than any real cell width (5deg
// azimuth steps, 50km range bins) or any real click's precision.
const BOUNDARY_EPSILON = 1e-9;

export function cellForLatLon(
  station: GeoPoint,
  shape: CellGridShape,
  point: GeoPoint,
): CellCoordinate {
  const bearingDeg = initialBearingDeg(station, point);
  const rangeKm = haversineDistanceKm(station, point);
  const azimuthStepDeg = 360 / shape.azimuthCount;
  const azimuthIndex =
    Math.floor((bearingDeg + BOUNDARY_EPSILON) / azimuthStepDeg) % shape.azimuthCount;
  const rangeBin = Math.floor((rangeKm + BOUNDARY_EPSILON) / shape.rangeBinKm);

  return { azimuthIndex, rangeBin, bearingDeg, rangeKm };
}
