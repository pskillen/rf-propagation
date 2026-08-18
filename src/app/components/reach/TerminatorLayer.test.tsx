import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapContainer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type L from 'leaflet';
import type { GeoPoint } from '@core/domain/propagation/greatCircle';
import * as solarTerminatorModule from '@core/domain/propagation/solarTerminator';
import {
  computeSolarTerminator,
  computeSubsolarPoint,
} from '@core/domain/propagation/solarTerminator';
import TerminatorLayer, {
  buildNightPolygonPositions,
  unwrapRingLongitudes,
} from './TerminatorLayer.tsx';

const EQUINOX_SOLAR_NOON_UTC = Date.UTC(2024, 2, 20, 12, 0, 0);
const JUNE_SOLSTICE_NOON_UTC = Date.UTC(2024, 5, 20, 12, 0, 0);
const DECEMBER_SOLSTICE_NOON_UTC = Date.UTC(2024, 11, 20, 12, 0, 0);

describe('unwrapRingLongitudes', () => {
  it('keeps consecutive points within 180deg of each other (no antimeridian jump)', () => {
    const ring: GeoPoint[] = [
      { latDeg: 10, lonDeg: 179 },
      { latDeg: 11, lonDeg: -179 }, // "really" 181, normalised to -179
      { latDeg: 12, lonDeg: -178 },
    ];

    const unwrapped = unwrapRingLongitudes(ring);

    expect(unwrapped[0].lonDeg).toBe(179);
    expect(unwrapped[1].lonDeg).toBeCloseTo(181, 6);
    expect(unwrapped[2].lonDeg).toBeCloseTo(182, 6);
  });

  it('is a no-op for a ring that never crosses the seam', () => {
    const ring: GeoPoint[] = [
      { latDeg: 0, lonDeg: 0 },
      { latDeg: 5, lonDeg: 10 },
      { latDeg: 10, lonDeg: 20 },
    ];
    expect(unwrapRingLongitudes(ring)).toEqual(ring);
  });

  it('returns an empty array for an empty ring', () => {
    expect(unwrapRingLongitudes([])).toEqual([]);
  });

  it('anchors ring[0] near a given anchor longitude, not its own raw value', () => {
    const ring: GeoPoint[] = [
      { latDeg: 10, lonDeg: -170 },
      { latDeg: 11, lonDeg: -171 },
    ];
    // e.g. the map has been panned 2.5 world-widths east of the prime
    // meridian -- Leaflet allows this (dragging repeatedly east keeps
    // scrolling rather than snapping back to +-180).
    const anchorLonDeg = 900;

    const unwrapped = unwrapRingLongitudes(ring, anchorLonDeg);

    expect(Math.abs(unwrapped[0].lonDeg - anchorLonDeg)).toBeLessThanOrEqual(180);
    // Point-to-point continuity from the earlier "no fixed reference" fix
    // still holds once anchored.
    expect(unwrapped[1].lonDeg).toBeCloseTo(unwrapped[0].lonDeg - 1, 6);
  });

  it('defaults the anchor to ring[0]’s own longitude when omitted (unchanged default behaviour)', () => {
    const ring: GeoPoint[] = [
      { latDeg: 10, lonDeg: 179 },
      { latDeg: 11, lonDeg: -179 },
    ];
    expect(unwrapRingLongitudes(ring)).toEqual(unwrapRingLongitudes(ring, ring[0].lonDeg));
  });
});

describe('buildNightPolygonPositions', () => {
  it('closes at the SOUTH pole when the northern hemisphere is in its summer (June solstice, noon)', () => {
    const ring = unwrapRingLongitudes(computeSolarTerminator(JUNE_SOLSTICE_NOON_UTC));
    const positions = buildNightPolygonPositions(ring, JUNE_SOLSTICE_NOON_UTC);

    expect(positions).not.toBeNull();
    const closingLats = positions!.slice(-2).map(([lat]) => lat);
    expect(closingLats.every((lat) => lat < 0)).toBe(true);
  });

  it('closes at the NORTH pole when the northern hemisphere is in its winter (December solstice, noon)', () => {
    const ring = unwrapRingLongitudes(computeSolarTerminator(DECEMBER_SOLSTICE_NOON_UTC));
    const positions = buildNightPolygonPositions(ring, DECEMBER_SOLSTICE_NOON_UTC);

    expect(positions).not.toBeNull();
    const closingLats = positions!.slice(-2).map(([lat]) => lat);
    expect(closingLats.every((lat) => lat > 0)).toBe(true);
  });

  it('the closing vertices span the ring’s own first/last unwrapped longitude', () => {
    const ring = unwrapRingLongitudes(computeSolarTerminator(JUNE_SOLSTICE_NOON_UTC));
    const positions = buildNightPolygonPositions(ring, JUNE_SOLSTICE_NOON_UTC)!;
    const [, secondLastLon] = positions[positions.length - 2];
    const [, lastLon] = positions[positions.length - 1];

    expect(secondLastLon).toBeCloseTo(ring[ring.length - 1].lonDeg, 6);
    expect(lastLon).toBeCloseTo(ring[0].lonDeg, 6);
  });

  it('returns null for a degenerate (too-short) ring', () => {
    expect(
      buildNightPolygonPositions([{ latDeg: 0, lonDeg: 0 }], EQUINOX_SOLAR_NOON_UTC),
    ).toBeNull();
  });
});

describe('TerminatorLayer (rendered inside a real Leaflet map)', () => {
  it('renders a terminator polyline and a sun marker when visible', async () => {
    const { container } = render(
      <MapContainer center={[0, 0]} zoom={2} className="map">
        <TerminatorLayer atMs={JUNE_SOLSTICE_NOON_UTC} visible />
      </MapContainer>,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('.leaflet-overlay-pane path')).not.toHaveLength(0);
    });

    // Terminator polyline + night polygon (both <path>s) + sun CircleMarker
    // (also a <path> in Leaflet's SVG renderer) -- at least 2 (polyline +
    // marker), 3 whenever the night polygon isn't degenerate (it isn't at
    // a solstice).
    const paths = container.querySelectorAll('.leaflet-overlay-pane path');
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it('renders nothing when visible is false', () => {
    const { container } = render(
      <MapContainer center={[0, 0]} zoom={2} className="map">
        <TerminatorLayer atMs={JUNE_SOLSTICE_NOON_UTC} visible={false} />
      </MapContainer>,
    );

    expect(container.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(0);
  });

  it('moves the sun marker when atMs changes', async () => {
    const morning = Date.UTC(2024, 5, 20, 6, 0, 0);
    const noon = Date.UTC(2024, 5, 20, 12, 0, 0);
    const morningSun = computeSubsolarPoint(morning);
    const noonSun = computeSubsolarPoint(noon);
    // Sanity check the fixture itself actually moves before asserting on the DOM.
    expect(morningSun.lonDeg).not.toBeCloseTo(noonSun.lonDeg, 0);

    const { container, rerender } = render(
      <MapContainer center={[0, 0]} zoom={2} className="map">
        <TerminatorLayer atMs={morning} visible />
      </MapContainer>,
    );
    await waitFor(() => {
      expect(container.querySelectorAll('.leaflet-overlay-pane path').length).toBeGreaterThan(0);
    });
    const pathsAtMorning = Array.from(container.querySelectorAll('.leaflet-overlay-pane path')).map(
      (path) => path.getAttribute('d'),
    );

    rerender(
      <MapContainer center={[0, 0]} zoom={2} className="map">
        <TerminatorLayer atMs={noon} visible />
      </MapContainer>,
    );
    await waitFor(() => {
      const pathsAtNoon = Array.from(container.querySelectorAll('.leaflet-overlay-pane path')).map(
        (path) => path.getAttribute('d'),
      );
      expect(pathsAtNoon).not.toEqual(pathsAtMorning);
    });
  });

  it('does not recompute the terminator geometry on a re-render with the same atMs (memoized)', async () => {
    const computeSolarTerminatorSpy = vi.spyOn(solarTerminatorModule, 'computeSolarTerminator');
    const computeSubsolarPointSpy = vi.spyOn(solarTerminatorModule, 'computeSubsolarPoint');

    const { container, rerender } = render(
      <MapContainer center={[0, 0]} zoom={2} className="map">
        <TerminatorLayer atMs={JUNE_SOLSTICE_NOON_UTC} visible />
      </MapContainer>,
    );
    await waitFor(() => {
      expect(container.querySelectorAll('.leaflet-overlay-pane path').length).toBeGreaterThan(0);
    });
    const callsAfterFirstRender = computeSolarTerminatorSpy.mock.calls.length;
    expect(callsAfterFirstRender).toBeGreaterThan(0);

    // `ReachPage.tsx` re-renders on every parent update (e.g. a coverage
    // grid result landing), independent of whether the throttled `atMs` it
    // passes down actually changed -- the memoization inside TerminatorLayer
    // itself, not just the throttling upstream, is what stops the ~180-point
    // ring/subsolar-point geometry from being recomputed on every one of
    // those unrelated re-renders.
    rerender(
      <MapContainer center={[0, 0]} zoom={2} className="map">
        <TerminatorLayer atMs={JUNE_SOLSTICE_NOON_UTC} visible />
      </MapContainer>,
    );

    expect(computeSolarTerminatorSpy.mock.calls.length).toBe(callsAfterFirstRender);
    expect(computeSubsolarPointSpy.mock.calls.length).toBe(callsAfterFirstRender);

    computeSolarTerminatorSpy.mockRestore();
    computeSubsolarPointSpy.mockRestore();
  });

  it('keeps the terminator anchored near the map’s current center after panning several world-widths east (antimeridian-wrap regression)', async () => {
    // jsdom has no real layout engine (the map container always measures
    // 0x0), so Leaflet's SVG renderer can't be trusted to produce
    // meaningful pixel/path output here -- this asserts on the actual
    // Leaflet LatLng data fed to the polyline instead, which is what a
    // real browser's renderer then projects to pixels (and was confirmed
    // live, in a real browser, to go fully off-screen once the map had
    // been dragged east several world-widths).
    let mapInstance: L.Map | null = null;

    render(
      <MapContainer
        ref={(instance) => {
          mapInstance = instance;
        }}
        center={[0, 0]}
        zoom={2}
        className="map"
      >
        <TerminatorLayer atMs={JUNE_SOLSTICE_NOON_UTC} visible />
      </MapContainer>,
    );

    await waitFor(() => expect(mapInstance).not.toBeNull());

    // The terminator Polyline is the only layer with this dashArray --
    // distinguishes it from the night Polygon (a plain fill, no dashArray)
    // and the sun CircleMarker (not a Polyline at all).
    const terminatorFirstLng = (): number | null => {
      let lng: number | null = null;
      mapInstance!.eachLayer((layer) => {
        const polyline = layer as L.Polyline;
        if ((polyline.options as L.PolylineOptions)?.dashArray === '6 6') {
          const [first] = polyline.getLatLngs() as L.LatLng[];
          lng = first?.lng ?? null;
        }
      });
      return lng;
    };

    await waitFor(() => {
      const lng = terminatorFirstLng();
      expect(lng).not.toBeNull();
      // On screen relative to the map's own center is exactly "within
      // +-180 of it" -- Leaflet's projection is linear, not clamped,
      // beyond that range.
      expect(Math.abs(lng! - mapInstance!.getCenter().lng)).toBeLessThanOrEqual(180);
    });

    // Reproduces the reported bug: Leaflet allows unbounded panning
    // (dragging repeatedly east keeps scrolling rather than snapping back
    // to +-180 -- confirmed live in a real browser by dragging the Reach
    // map east several times, which made the greyline vanish entirely).
    // Before this fix, the terminator ring was unwrapped once and anchored
    // only to wherever `ring[0]` happened to land (near the subsolar
    // longitude, with no relationship to the map's current view), so it
    // would have stayed put here instead of following the pan.
    mapInstance!.setView([0, 900], 2, { animate: false }); // 2.5 world-widths east

    await waitFor(() => {
      const lng = terminatorFirstLng();
      expect(lng).not.toBeNull();
      expect(Math.abs(lng! - mapInstance!.getCenter().lng)).toBeLessThanOrEqual(180);
    });
  });
});
