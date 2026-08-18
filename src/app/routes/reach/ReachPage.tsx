// Reach — the coverage surface (F5, phase 8). Slice 1: the 2D map with a
// live-draggable station marker. Later slices (Coverage grid, and
// shading/legend/summary/target panels) add to `controls`/`canvas` in
// place, not by replacing this file's overall shape.
import { useCallback } from 'react';
import { coordsToLocator } from '@core/domain/maidenhead';
import { mergeStation } from '@integrations/station/persistence';
import SurfaceLayout from '../../components/layout/SurfaceLayout.tsx';
import ReachMap from '../../components/reach/ReachMap.tsx';
import { useViewerState } from '../../state/viewerState.tsx';

export default function ReachPage() {
  const { state, setState } = useViewerState();
  const { station } = state;

  // Only `dragend` persists a QTH change (Slice 1's own "debouncing
  // applies to persistence, never to rendering" rule) -- `drag` itself
  // drives the live coverage recompute wired in Slice 2, not a Station
  // write. `mergeStation` (not a raw `setState` patch) keeps this the
  // same single write path every other QTH-setting affordance
  // (QthPicker's map/locator/address/geolocation routes) already uses.
  const handleStationDragEnd = useCallback(
    (lat: number, lon: number) => {
      const next = mergeStation({
        qth: { ...station.qth, lat, lon, locator: coordsToLocator(lat, lon), source: 'map' },
      });
      setState((prev) => ({ ...prev, station: next }));
    },
    [station.qth, setState],
  );

  return (
    <SurfaceLayout
      controls={<p>Reach’s legend and summary strip arrive in later slices.</p>}
      canvas={
        <ReachMap
          station={station}
          onStationDrag={() => {
            // Slice 2 wires this into a live coverage-grid recompute.
          }}
          onStationDragEnd={handleStationDragEnd}
        />
      }
    />
  );
}
