// Reach — the coverage surface (F5, phase 8). Slice 1: the 2D map with a
// live-draggable station marker. Slice 2: the coverage grid itself,
// recomputed live while dragging. Later slices (shading/legend/summary/
// target panels) add to `controls`/`canvas` in place, not by replacing
// this file's overall shape.
import { useCallback, useState } from 'react';
import { coordsToLocator } from '@core/domain/maidenhead';
import { mergeStation } from '@integrations/station/persistence';
import SurfaceLayout from '../../components/layout/SurfaceLayout.tsx';
import { ToggleSwitch } from '../../components/v2/index.ts';
import CoverageLegend from '../../components/reach/CoverageLegend.tsx';
import ReachMap from '../../components/reach/ReachMap.tsx';
import ReachSummaryStrip from '../../components/reach/ReachSummaryStrip.tsx';
import TargetPanel from '../../components/reach/TargetPanel.tsx';
import { useBestBandNow } from '../../components/reach/useBestBandNow.ts';
import { useReachCoverage } from '../../components/reach/useReachCoverage.ts';
import { useViewerState } from '../../state/viewerState.tsx';
import classes from './ReachPage.module.css';

export default function ReachPage() {
  const { state, setState } = useViewerState();
  const { station, conditions, frequencyMhz, target } = state;

  // The live-drag position, distinct from `station.qth` (which only
  // updates on `dragend`) -- Slice 2's coverage grid is computed FOR this
  // point while dragging, so the shaded surface and the cell->latlon
  // projection both stay correct mid-gesture, not just after release.
  const [dragQth, setDragQth] = useState<{ lat: number; lon: number } | null>(null);

  // Slice 5 (fix/reach-directionality-antenna-greyline): local to Reach
  // only, not a global display-toggle registry (phase 10 hasn't built
  // that yet) -- default ON, since most users are on this 2D map and were
  // seeing none of this before.
  const [showTerminator, setShowTerminator] = useState(true);

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

  // Cell selection sets a target (F5.5, Slice 5) -- "record a target,"
  // not build a Path view (phase 13's job). `source: 'map-click'` is the
  // only source this phase produces; Path's own target picker (phase 13)
  // adds locator/coordinates/place-name entry as additional sources on
  // top of this, per this phase's own cross-phase note.
  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      setState((prev) => ({
        ...prev,
        target: { lat, lon, label: undefined, source: 'map-click' },
      }));
    },
    [setState],
  );

  const handleClearTarget = useCallback(() => {
    setState((prev) => ({ ...prev, target: null }));
  }, [setState]);

  return (
    <SurfaceLayout
      controls={
        <div className={classes.controls}>
          {target ? (
            <TargetPanel station={station.qth} target={target} onClear={handleClearTarget} />
          ) : null}
          <ReachSummaryStrip coverageResult={result} bandRankings={bandRankings} />
          <CoverageLegend />
          <ToggleSwitch
            checked={showTerminator}
            onChange={setShowTerminator}
            label="Greyline (day/night terminator)"
          />
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
          target={target}
          onMapClick={handleMapClick}
          atMs={conditions.atMs}
          showTerminator={showTerminator}
        />
      }
    />
  );
}
