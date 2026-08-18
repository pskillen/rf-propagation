// Reach — the coverage surface (F5, phase 8). Slice 1: the 2D map with a
// live-draggable station marker. Slice 2: the coverage grid itself,
// recomputed live while dragging. Later slices (shading/legend/summary/
// target panels) add to `controls`/`canvas` in place, not by replacing
// this file's overall shape.
import { useCallback, useState } from 'react';
import { coordsToLocator } from '@core/domain/maidenhead';
import { mergeStation } from '@integrations/station/persistence';
import SurfaceLayout from '../../components/layout/SurfaceLayout.tsx';
import CoverageLegend from '../../components/reach/CoverageLegend.tsx';
import ReachMap from '../../components/reach/ReachMap.tsx';
import ReachSummaryStrip from '../../components/reach/ReachSummaryStrip.tsx';
import { useBestBandNow } from '../../components/reach/useBestBandNow.ts';
import { useReachCoverage } from '../../components/reach/useReachCoverage.ts';
import { useViewerState } from '../../state/viewerState.tsx';
import classes from './ReachPage.module.css';

export default function ReachPage() {
  const { state, setState } = useViewerState();
  const { station, conditions, frequencyMhz } = state;

  // The live-drag position, distinct from `station.qth` (which only
  // updates on `dragend`) -- Slice 2's coverage grid is computed FOR this
  // point while dragging, so the shaded surface and the cell->latlon
  // projection both stay correct mid-gesture, not just after release.
  const [dragQth, setDragQth] = useState<{ lat: number; lon: number } | null>(null);

  const { result, pass, recompute } = useReachCoverage(station, conditions, frequencyMhz);
  // Best-band-now: its own per-band sweep, only re-run on Station/
  // Conditions change (Slice 4's own note -- not part of the live-drag path).
  const bandRankings = useBestBandNow(station, conditions);

  // "Fire a new request on every drag-move event, let the client's own
  // supersede logic handle the rest" (phase 4's own instruction) --
  // recompute() is called directly here, not debounced; CoverageGridClient
  // cancels/supersedes any still-in-flight request itself.
  const handleStationDrag = useCallback(
    (lat: number, lon: number) => {
      setDragQth({ lat, lon });
      recompute({ lat, lon });
    },
    [recompute],
  );

  // Only `dragend` persists a QTH change (Slice 1's own "debouncing
  // applies to persistence, never to rendering" rule). `mergeStation` (not
  // a raw `setState` patch) keeps this the same single write path every
  // other QTH-setting affordance (QthPicker's map/locator/address/
  // geolocation routes) already uses; committing `station.qth` here also
  // re-triggers useReachCoverage's own auto-recompute effect, so a second
  // explicit recompute() call here would just be a redundant duplicate.
  const handleStationDragEnd = useCallback(
    (lat: number, lon: number) => {
      const next = mergeStation({
        qth: { ...station.qth, lat, lon, locator: coordsToLocator(lat, lon), source: 'map' },
      });
      setDragQth(null);
      setState((prev) => ({ ...prev, station: next }));
    },
    [station.qth, setState],
  );

  const coverageStation = dragQth ?? station.qth;

  return (
    <SurfaceLayout
      controls={
        <div className={classes.controls}>
          <ReachSummaryStrip coverageResult={result} bandRankings={bandRankings} />
          <CoverageLegend />
        </div>
      }
      canvas={
        <ReachMap
          station={station}
          onStationDrag={handleStationDrag}
          onStationDragEnd={handleStationDragEnd}
          coverageResult={result}
          coveragePass={pass}
          coverageStation={coverageStation}
        />
      }
    />
  );
}
