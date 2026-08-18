// Reach — the coverage surface (F5, phase 8). Slice 1: the 2D map with a
// live-draggable station marker. Slice 2: the coverage grid itself,
// recomputed live while dragging. Later slices (shading/legend/summary/
// target panels) add to `controls`/`canvas` in place, not by replacing
// this file's overall shape. Phase 9 (Globe) adds the map/globe view
// switch and the globe's own Display panel, in place, the same way.
import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { coordsToLocator } from '@core/domain/maidenhead';
import { mergeStation } from '@integrations/station/persistence';
import SurfaceLayout from '../../components/layout/SurfaceLayout.tsx';
import {
  Panel,
  SegmentedControl,
  ToggleSwitch,
  type SegmentedControlOption,
} from '../../components/v2/index.ts';
import CoverageLegend from '../../components/reach/CoverageLegend.tsx';
import ReachMap from '../../components/reach/ReachMap.tsx';
import ReachSummaryStrip from '../../components/reach/ReachSummaryStrip.tsx';
import TargetPanel from '../../components/reach/TargetPanel.tsx';
import { computeLayerStates } from '../../components/reach/buildCoverageGridInput.ts';
import { useBestBandNow } from '../../components/reach/useBestBandNow.ts';
import { useReachCoverage } from '../../components/reach/useReachCoverage.ts';
import GlobeDisplayPanel from '../../components/HfPropagationGlobe/GlobeDisplayPanel.tsx';
import type { GlobeToggles } from '../../state/globeToggles.ts';
import { useThrottledConditions } from '../../hooks/useThrottledConditions.ts';
import { useViewerState } from '../../state/viewerState.tsx';
import classes from './ReachPage.module.css';

// Lazy-loaded (F6.1's own AC) -- map-first surfaces never download the
// three/react-globe.gl bundle unless the operator switches to the globe
// view (default is 'map', see DEFAULT_GLOBE_TOGGLES).
const HfPropagationGlobe = lazy(
  () => import('../../components/HfPropagationGlobe/HfPropagationGlobe.tsx'),
);

const VIEW_OPTIONS: SegmentedControlOption<'map' | 'globe'>[] = [
  { value: 'map', label: 'Map' },
  { value: 'globe', label: 'Globe' },
];

export default function ReachPage() {
  const { state, setState } = useViewerState();
  const { station, conditions, frequencyMhz, target } = state;
  const globeToggles = state.display.globeToggles;

  // The live-drag position, distinct from `station.qth` (which only
  // updates on `dragend`) -- Slice 2's coverage grid is computed FOR this
  // point while dragging, so the shaded surface and the cell->latlon
  // projection both stay correct mid-gesture, not just after release.
  const [dragQth, setDragQth] = useState<{ lat: number; lon: number } | null>(null);

  // Slice 5 (fix/reach-directionality-antenna-greyline): local to Reach
  // only, not a global display-toggle registry (phase 10 hasn't built
  // that yet) -- default ON, since most users are on this 2D map and were
  // seeing none of this before. The globe's own terminator toggle
  // (globeToggles.terminatorEnabled, phase 9) is a SEPARATE control --
  // switching map <-> globe does not share this state, matching how the
  // two surfaces' Display panels are otherwise independent.
  const [showTerminator, setShowTerminator] = useState(true);

  const { result, pass, recompute } = useReachCoverage(station, conditions, frequencyMhz);
  // Best-band-now: its own per-band sweep, only re-run on Station/
  // Conditions change (Slice 4's own note -- not part of the live-drag path).
  const bandRankings = useBestBandNow(station, conditions);

  // The greyline's own recompute cadence -- `TerminatorLayer` redoes a
  // 180-point geometric ring on every `atMs` it's given, so feeding it the
  // raw, 1s-ticking `conditions.atMs` re-ran that on every live clock tick
  // too (same mechanical cause as `useReachCoverage`/`useBestBandNow`'s
  // fix above, just cheaper per-call). `TerminatorLayer` itself memoizes
  // on this value, so a throttled prop is what actually stops the redundant
  // recompute, not just how often it's passed down. The globe's own
  // day/night terminator/night-shade (phase 9, Slice 1) is driven by this
  // SAME throttled instant, for the same reason.
  const throttledConditions = useThrottledConditions(conditions);

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

  // Phase 9, Slice 5 (F6.5) -- the whole ViewerState.display.globeToggles
  // object round-trips through the URL codec, so writes here go through
  // the same setState path every other ViewerState sub-object uses.
  const handleGlobeTogglesChange = useCallback(
    (next: GlobeToggles) => {
      setState((prev) => ({ ...prev, display: { ...prev.display, globeToggles: next } }));
    },
    [setState],
  );

  const handleMapModeChange = useCallback(
    (mapMode: 'map' | 'globe') => {
      handleGlobeTogglesChange({ ...globeToggles, mapMode });
    },
    [globeToggles, handleGlobeTogglesChange],
  );

  // Phase 9, Slice 1 -- the SAME LayerState[] computeCoverageGrid already
  // derives from Station/Conditions (buildCoverageGridInput.ts), reused
  // here rather than a second computation, so the globe's shells and the
  // coverage grid always agree on what the ionosphere is doing right now.
  // Recomputed from the live-drag position (coverageStation), same as the
  // coverage grid itself, so shells stay correct mid-gesture too.
  const layers = useMemo(
    () => computeLayerStates(coverageStation, throttledConditions),
    [coverageStation, throttledConditions],
  );

  // Cutaway default bearing (Slice 2): the active antenna's heading when
  // directional, else 0 -- same fallback mk1 uses via its own
  // `defaultSliceBearingDeg`, per this phase's plan file.
  const activeAntenna =
    station.antennas.find((antenna) => antenna.id === station.activeAntennaId) ??
    station.antennas[0];
  const sliceBearingDeg =
    activeAntenna?.family === 'directional-lobe' ? (activeAntenna.azimuthDeg ?? 0) : 0;

  return (
    <SurfaceLayout
      controls={
        <div className={classes.controls}>
          {target ? (
            <TargetPanel station={station.qth} target={target} onClear={handleClearTarget} />
          ) : null}
          <ReachSummaryStrip coverageResult={result} bandRankings={bandRankings} />
          <Panel title="View">
            <SegmentedControl
              options={VIEW_OPTIONS}
              value={globeToggles.mapMode}
              onChange={handleMapModeChange}
              aria-label="View"
            />
          </Panel>
          {globeToggles.mapMode === 'globe' ? (
            <GlobeDisplayPanel value={globeToggles} onChange={handleGlobeTogglesChange} />
          ) : (
            <>
              <CoverageLegend />
              <ToggleSwitch
                checked={showTerminator}
                onChange={setShowTerminator}
                label="Greyline (day/night terminator)"
              />
            </>
          )}
        </div>
      }
      canvas={
        globeToggles.mapMode === 'globe' ? (
          <Suspense fallback={<div className={classes.globeLoading}>Loading 3D globe…</div>}>
            <HfPropagationGlobe
              layers={layers}
              display={{
                exaggerationFactor: globeToggles.exaggerationFactor,
                explodeEnabled: globeToggles.explodeEnabled,
                fresnelEnabled: globeToggles.fresnelEnabled,
              }}
              environmentAtMs={throttledConditions.atMs}
              terminatorEnabled={globeToggles.terminatorEnabled}
              txLat={coverageStation.lat}
              txLon={coverageStation.lon}
              coverageResult={result}
              cutawayEnabled={globeToggles.cutawayEnabled}
              sliceBearingDeg={sliceBearingDeg}
            />
          </Suspense>
        ) : (
          <ReachMap
            station={station}
            onStationDrag={handleStationDrag}
            onStationDragEnd={handleStationDragEnd}
            coverageResult={result}
            coveragePass={pass}
            coverageStation={coverageStation}
            target={target}
            onMapClick={handleMapClick}
            atMs={throttledConditions.atMs}
            showTerminator={showTerminator}
          />
        )
      }
    />
  );
}
