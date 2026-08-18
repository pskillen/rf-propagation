import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type L from 'leaflet';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import ReachMap, { type ReachMapProps } from './ReachMap.tsx';

function fixtureResult(): CoverageGridResult {
  const azimuthCount = 4;
  const rangeBinCount = 4;
  const cellCount = azimuthCount * rangeBinCount;
  return {
    azimuthCount,
    rangeBinCount,
    rangeBinKm: 50,
    reliability: new Float32Array(cellCount).fill(0.8),
    snrDb: new Float32Array(cellCount).fill(20),
    hopCount: new Uint8Array(cellCount).fill(0),
  };
}

const DEFAULT_PROPS = {
  coverageResult: null,
  coveragePass: null,
  coverageStation: null,
  target: null,
  onMapClick: () => {},
} satisfies Pick<
  ReachMapProps,
  'coverageResult' | 'coveragePass' | 'coverageStation' | 'target' | 'onMapClick'
>;

describe('ReachMap', () => {
  it('renders the station marker and OSM tiles', async () => {
    const { container } = render(
      <ReachMap
        station={DEFAULT_STATION}
        onStationDrag={() => {}}
        onStationDragEnd={() => {}}
        {...DEFAULT_PROPS}
      />,
    );

    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    await waitFor(() => {
      expect(container.querySelector('.leaflet-marker-icon')).not.toBeNull();
    });
    expect(container.querySelector('img.leaflet-tile, .leaflet-tile-pane')).not.toBeNull();
  });

  it('a continuous Leaflet `drag` event calls onStationDrag with the marker’s live position (not just dragend)', async () => {
    const onStationDrag = vi.fn();
    const onStationDragEnd = vi.fn();

    let markerInstance: L.Marker | null = null;
    const { container } = render(
      <ReachMap
        station={DEFAULT_STATION}
        onStationDrag={onStationDrag}
        onStationDragEnd={onStationDragEnd}
        {...DEFAULT_PROPS}
        markerRef={(instance) => {
          markerInstance = instance;
        }}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('.leaflet-marker-icon')).not.toBeNull();
      expect(markerInstance).not.toBeNull();
    });

    // Firing `drag`/`dragend` directly on the real Leaflet Marker instance
    // (rather than simulating low-level pointer/touch geometry, which
    // jsdom's layout-free environment can't drive) exercises the SAME
    // eventHandlers this component registers with Leaflet -- it just
    // skips Leaflet's own mouse-to-drag translation, which is Leaflet's
    // concern, not this component's.
    const NEW_LAT = DEFAULT_STATION.qth.lat + 1;
    const NEW_LON = DEFAULT_STATION.qth.lon + 1;
    markerInstance!.setLatLng([NEW_LAT, NEW_LON]);
    markerInstance!.fire('drag');

    expect(onStationDrag).toHaveBeenCalledWith(NEW_LAT, NEW_LON);
    expect(onStationDragEnd).not.toHaveBeenCalled();

    markerInstance!.fire('dragend');
    expect(onStationDragEnd).toHaveBeenCalledWith(NEW_LAT, NEW_LON);
  });

  it('mounts a coverage canvas layer, sized to the map, once a result is supplied (Slice 2)', async () => {
    const { container, rerender } = render(
      <ReachMap
        station={DEFAULT_STATION}
        onStationDrag={() => {}}
        onStationDragEnd={() => {}}
        {...DEFAULT_PROPS}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('canvas.reach-coverage-canvas')).not.toBeNull();
    });

    rerender(
      <ReachMap
        station={DEFAULT_STATION}
        onStationDrag={() => {}}
        onStationDragEnd={() => {}}
        {...DEFAULT_PROPS}
        coverageResult={fixtureResult()}
        coveragePass="fine"
        coverageStation={{ lat: DEFAULT_STATION.qth.lat, lon: DEFAULT_STATION.qth.lon }}
      />,
    );

    // jsdom has no real layout engine (the map container's measured size is
    // always 0x0), so this can't assert real pixel dimensions -- it
    // confirms the redraw pipeline actually ran for the new result (the
    // canvas settles at full opacity) rather than being skipped.
    await waitFor(() => {
      const canvas = container.querySelector('canvas.reach-coverage-canvas') as HTMLCanvasElement;
      expect(canvas.style.opacity).toBe('1');
    });
  });

  it('a map click (not drag) calls onMapClick with the clicked lat/lon (Slice 5)', async () => {
    const onMapClick = vi.fn();
    let mapInstance: L.Map | null = null;

    render(
      <ReachMap
        station={DEFAULT_STATION}
        onStationDrag={() => {}}
        onStationDragEnd={() => {}}
        {...DEFAULT_PROPS}
        onMapClick={onMapClick}
        mapRef={(instance) => {
          mapInstance = instance;
        }}
      />,
    );

    await waitFor(() => expect(mapInstance).not.toBeNull());

    const CLICK_LAT = 51.2;
    const CLICK_LON = -3.1;
    // Firing `click` directly on the real Leaflet Map instance (same
    // rationale as the marker drag test above) -- exercises the same
    // useMapEvents handler this component registers, without simulating
    // real pointer-to-latlng geometry jsdom can't drive.
    mapInstance!.fire('click', { latlng: { lat: CLICK_LAT, lng: CLICK_LON } });

    expect(onMapClick).toHaveBeenCalledWith(CLICK_LAT, CLICK_LON);
  });

  it('renders a target marker distinct from the station marker when a target is set', async () => {
    const { container } = render(
      <ReachMap
        station={DEFAULT_STATION}
        onStationDrag={() => {}}
        onStationDragEnd={() => {}}
        {...DEFAULT_PROPS}
        target={{ lat: 51.2, lon: -3.1 }}
      />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(2);
    });
  });
});
