// Day/night terminator line + subsolar-point marker for Reach's 2D map
// (Slice 5, fix/reach-directionality-antenna-greyline) -- react-leaflet's
// own declarative Polyline/CircleMarker/Polygon are enough here, unlike
// CoverageCanvasLayer: Leaflet already has first-class wrappers for a
// line and a small circle marker, no custom L.Layer subclass needed.
import { CircleMarker, Polygon, Polyline } from 'react-leaflet';
import {
  computeSolarTerminator,
  computeSubsolarPoint,
} from '@core/domain/propagation/solarTerminator';
import type { GeoPoint } from '@core/domain/propagation/greatCircle';
import { solarZenithAngleDeg } from '@core/domain/propagation/solarZenithAngle';
import { unwrapLongitudeRelativeTo } from '../../lib/geo/unwrapLongitude.ts';

const TERMINATOR_LINE_COLOR = '#f4b400';
const SUN_MARKER_FILL_COLOR = '#f4b400';
const NIGHT_FILL_COLOR = '#0b1a3a';
const NIGHT_FILL_OPACITY = 0.28;

/**
 * Leaflet's Web Mercator projection has a singularity at the true poles --
 * the night-shading polygon's own closing vertices (see
 * `buildNightPolygonPositions`) use this instead of the literal ±90°, one
 * degree short of the projection's own default max latitude
 * (~85.0511°), matching how the standard OSM tile layer already clips.
 */
const POLE_CAP_LAT_DEG = 85;

/**
 * Unwraps a ring's longitudes relative to EACH PREVIOUS point (not one
 * fixed reference) -- same problem, same fix, as
 * `coverageCellProjection.ts`'s cell corners: `computeSolarTerminator`
 * normalises each point's raw longitude independently, so two
 * geographically-close ring points can land on opposite sides of the
 * ±180° seam even though the ring itself sweeps smoothly. Unwrapping
 * point-to-point (rather than against one fixed reference) keeps this
 * correct regardless of where the ring happens to start.
 */
export function unwrapRingLongitudes(ring: GeoPoint[]): GeoPoint[] {
  if (ring.length === 0) return [];
  const unwrapped: GeoPoint[] = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const previous = unwrapped[i - 1];
    unwrapped.push({
      latDeg: ring[i].latDeg,
      lonDeg: unwrapLongitudeRelativeTo(ring[i].lonDeg, previous.lonDeg),
    });
  }
  return unwrapped;
}

/**
 * Best-effort night-hemisphere fill polygon -- Slice 5's own explicitly
 * flagged "fiddlier half" of the greyline work. The terminator (a great
 * circle) is single-valued in longitude, so an already-unwrapped ring
 * traces a continuous curve across one full 360° span; closing it at
 * whichever pole is currently in darkness (spanning that same longitude
 * range) bounds exactly the night hemisphere in this projection -- the
 * same "sample the boundary, then cap at the dark pole" technique common
 * greyline implementations use.
 *
 * Returns `null` at the rare near-exact-equinox instant where neither
 * pole is unambiguously in night (both read ~90° zenith too) -- rather
 * than guess which side to shade, this slice's own fallback (per the plan
 * file) is to omit the fill and keep only the line + sun marker.
 */
export function buildNightPolygonPositions(
  unwrappedRing: GeoPoint[],
  atMs: number,
): [number, number][] | null {
  if (unwrappedRing.length < 2) return null;

  const northIsNight = solarZenithAngleDeg(90, 0, atMs) > 90;
  const southIsNight = solarZenithAngleDeg(-90, 0, atMs) > 90;
  if (northIsNight === southIsNight) return null;

  const capLatDeg = northIsNight ? POLE_CAP_LAT_DEG : -POLE_CAP_LAT_DEG;
  const first = unwrappedRing[0];
  const last = unwrappedRing[unwrappedRing.length - 1];

  const positions: [number, number][] = unwrappedRing.map((point) => [point.latDeg, point.lonDeg]);
  positions.push([capLatDeg, last.lonDeg], [capLatDeg, first.lonDeg]);
  return positions;
}

export interface TerminatorLayerProps {
  atMs: number;
  /** Local Reach-only toggle (Slice 5) -- default on, see ReachPage.tsx. */
  visible: boolean;
}

export default function TerminatorLayer({ atMs, visible }: TerminatorLayerProps) {
  if (!visible) return null;

  const ring = computeSolarTerminator(atMs);
  const unwrappedRing = unwrapRingLongitudes(ring);
  const linePositions: [number, number][] = unwrappedRing.map((point) => [
    point.latDeg,
    point.lonDeg,
  ]);
  const nightPolygonPositions = buildNightPolygonPositions(unwrappedRing, atMs);
  const sun = computeSubsolarPoint(atMs);

  return (
    <>
      {nightPolygonPositions ? (
        <Polygon
          positions={nightPolygonPositions}
          pathOptions={{
            stroke: false,
            fillColor: NIGHT_FILL_COLOR,
            fillOpacity: NIGHT_FILL_OPACITY,
          }}
          interactive={false}
        />
      ) : null}
      <Polyline
        positions={linePositions}
        pathOptions={{ color: TERMINATOR_LINE_COLOR, weight: 2, dashArray: '6 6' }}
        interactive={false}
      />
      <CircleMarker
        center={[sun.latDeg, sun.lonDeg]}
        radius={7}
        pathOptions={{
          color: '#fff',
          weight: 2,
          fillColor: SUN_MARKER_FILL_COLOR,
          fillOpacity: 1,
        }}
        interactive={false}
      />
    </>
  );
}
