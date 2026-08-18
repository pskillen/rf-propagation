// Day/night terminator line + subsolar-point marker for Reach's 2D map
// (Slice 5, fix/reach-directionality-antenna-greyline) -- react-leaflet's
// own declarative Polyline/CircleMarker/Polygon are enough here, unlike
// CoverageCanvasLayer: Leaflet already has first-class wrappers for a
// line and a small circle marker, no custom L.Layer subclass needed.
import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Polygon, Polyline, useMap } from 'react-leaflet';
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
 *
 * `anchorLonDeg` seeds where `ring[0]` itself lands (defaulting to its own
 * raw longitude, i.e. no shift, for callers -- e.g. this file's own tests
 * -- that don't care). `TerminatorLayer` passes the map's current center
 * longitude: Leaflet allows unbounded panning (dragging repeatedly east or
 * west keeps scrolling rather than snapping back to ±180), so a shape only
 * stays on screen if its raw longitudes are within ~180° of the map's
 * current, possibly many-times-wrapped, center longitude. Anchoring here
 * keeps the *whole chain* near the map's actual view; see this component's
 * `useMapCenterLonDeg` for the counterpart that keeps that anchor current
 * as the map pans (this mirrors -- in spirit, not code, since this is a
 * declarative react-leaflet layer rather than `CoverageCanvasLayer`'s
 * imperative `L.Layer` -- how that layer re-anchors and redraws on every
 * `move`).
 */
export function unwrapRingLongitudes(ring: GeoPoint[], anchorLonDeg?: number): GeoPoint[] {
  if (ring.length === 0) return [];
  const anchor = anchorLonDeg ?? ring[0].lonDeg;
  const unwrapped: GeoPoint[] = [
    { latDeg: ring[0].latDeg, lonDeg: unwrapLongitudeRelativeTo(ring[0].lonDeg, anchor) },
  ];
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
 * Tracks the map's current center longitude, re-rendering on every
 * Leaflet `move` (fires continuously mid-drag, not just on release) --
 * the map-awareness `TerminatorLayer` was missing entirely before this
 * fix (no `useMap()`, no move listener), which let its ring stay anchored
 * forever to wherever `ring[0]` happened to land when first computed, with
 * no relationship to what the map was actually showing. See
 * `unwrapRingLongitudes`'s own doc comment for why that anchor matters.
 */
function useMapCenterLonDeg(): number {
  const map = useMap();
  const [centerLonDeg, setCenterLonDeg] = useState(() => map.getCenter().lng);
  useEffect(() => {
    const update = () => setCenterLonDeg(map.getCenter().lng);
    map.on('move zoom', update);
    return () => {
      map.off('move zoom', update);
    };
  }, [map]);
  return centerLonDeg;
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
  // Hooks, so they must run every render, regardless of `visible` -- the
  // early return below stays AFTER these.
  //
  // `mapCenterLonDeg` re-renders on every map `move`/`zoom` -- cheap (just
  // re-running the point-to-point unwrap arithmetic below on the already-
  // computed ring), unlike `ring` itself, which stays memoized on `atMs`
  // alone. `ReachPage.tsx` passes a throttled `atMs` (at most once every
  // 60s while Conditions' live clock ticks every ~1s) -- without this
  // `useMemo` the throttling upstream wouldn't help, since this component
  // would still redo the ~180-point ring/subsolar-point geometry on every
  // render its parent triggers for unrelated reasons (e.g. the coverage
  // grid updating), not just on every `atMs` change. Panning the map is a
  // separate, legitimate reason to redo the (cheap) unwrap step -- see
  // `useMapCenterLonDeg`'s own doc comment for why it's needed at all.
  const mapCenterLonDeg = useMapCenterLonDeg();
  const ring = useMemo(() => computeSolarTerminator(atMs), [atMs]);
  const unwrappedRing = useMemo(
    () => unwrapRingLongitudes(ring, mapCenterLonDeg),
    [ring, mapCenterLonDeg],
  );
  const linePositions = useMemo<[number, number][]>(
    () => unwrappedRing.map((point) => [point.latDeg, point.lonDeg]),
    [unwrappedRing],
  );
  const nightPolygonPositions = useMemo(
    () => buildNightPolygonPositions(unwrappedRing, atMs),
    [unwrappedRing, atMs],
  );
  const sun = useMemo(() => computeSubsolarPoint(atMs), [atMs]);
  // The subsolar point is computed independently of the ring (its own
  // `atan2` normalisation), so it needs the same map-relative re-anchor --
  // otherwise the sun marker itself would go missing after enough panning,
  // same as the ring did before this fix.
  const sunPosition = useMemo<[number, number]>(
    () => [sun.latDeg, unwrapLongitudeRelativeTo(sun.lonDeg, mapCenterLonDeg)],
    [sun, mapCenterLonDeg],
  );

  if (!visible) return null;

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
        center={sunPosition}
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
