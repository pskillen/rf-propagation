import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type L from 'leaflet';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import ReachMap from './ReachMap.tsx';

describe('ReachMap', () => {
  it('renders the station marker and OSM tiles', async () => {
    const { container } = render(
      <ReachMap station={DEFAULT_STATION} onStationDrag={() => {}} onStationDragEnd={() => {}} />,
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
});
