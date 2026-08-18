import { describe, expect, it } from 'vitest';
import { destinationPoint, type GeoPoint } from '@core/domain/propagation/greatCircle';
import {
  cellCentre,
  cellCorners,
  cellForLatLon,
  type CellGridShape,
} from './coverageCellProjection.ts';

const STATION: GeoPoint = { latDeg: 52.4862, lonDeg: -1.8904 }; // DEFAULT_STATION's QTH
const SHAPE: CellGridShape = { azimuthCount: 72, rangeBinCount: 320, rangeBinKm: 50 };

describe('cellCentre', () => {
  it('matches a hand-computed great-circle destination for known (azimuth, rangeBin) inputs', () => {
    // azimuthIndex=0 -> bearing 0deg (due north); rangeBin=2 -> centre range 2*50 + 25 = 125km.
    const centre = cellCentre(STATION, SHAPE, 0, 2);
    const expected = destinationPoint(STATION, 0, 125);
    expect(centre.latDeg).toBeCloseTo(expected.latDeg, 9);
    expect(centre.lonDeg).toBeCloseTo(expected.lonDeg, 9);
  });

  it.each([
    [0, 0],
    [18, 5], // due east (90deg), bin 5 -> 275km
    [36, 10], // due south (180deg), bin 10 -> 525km
    [54, 1], // due west (270deg), bin 1 -> 75km
  ])(
    'azimuthIndex=%d, rangeBin=%d matches destinationPoint at the same bearing/range',
    (az, bin) => {
      const bearingDeg = az * (360 / SHAPE.azimuthCount);
      const rangeKm = bin * SHAPE.rangeBinKm + SHAPE.rangeBinKm / 2;
      const centre = cellCentre(STATION, SHAPE, az, bin);
      const expected = destinationPoint(STATION, bearingDeg, rangeKm);
      expect(centre).toEqual(expected);
    },
  );
});

describe('cellCorners', () => {
  it('returns 4 corners bracketing the cell centre in bearing and range', () => {
    const corners = cellCorners(STATION, SHAPE, 10, 3);
    expect(corners).toHaveLength(4);
    // Every corner should be strictly further from the station than the
    // inner range edge and no further than the outer range edge.
    const innerRangeKm = 3 * SHAPE.rangeBinKm;
    const outerRangeKm = 4 * SHAPE.rangeBinKm;
    for (const corner of corners) {
      const centreDistanceKm =
        Math.acos(
          Math.sin((STATION.latDeg * Math.PI) / 180) * Math.sin((corner.latDeg * Math.PI) / 180) +
            Math.cos((STATION.latDeg * Math.PI) / 180) *
              Math.cos((corner.latDeg * Math.PI) / 180) *
              Math.cos(((corner.lonDeg - STATION.lonDeg) * Math.PI) / 180),
        ) * 6371;
      expect(centreDistanceKm).toBeGreaterThanOrEqual(innerRangeKm - 1);
      expect(centreDistanceKm).toBeLessThanOrEqual(outerRangeKm + 1);
    }
  });
});

describe('cellForLatLon', () => {
  it('round-trips cellCentre -> cellForLatLon back to the same (azimuthIndex, rangeBin)', () => {
    const cases: Array<[number, number]> = [
      [0, 0],
      [1, 1],
      [18, 5],
      [36, 10],
      [54, 20],
      [71, 3],
    ];
    for (const [az, bin] of cases) {
      const centre = cellCentre(STATION, SHAPE, az, bin);
      const recovered = cellForLatLon(STATION, SHAPE, centre);
      expect(recovered.azimuthIndex).toBe(az);
      expect(recovered.rangeBin).toBe(bin);
    }
  });

  it('reports bearing/range consistent with the clicked point', () => {
    const point = destinationPoint(STATION, 214, 1840);
    const result = cellForLatLon(STATION, SHAPE, point);
    expect(result.bearingDeg).toBeCloseTo(214, 3);
    expect(result.rangeKm).toBeCloseTo(1840, 3);
  });
});
