// Explore — the "what's going on up there" surface (F8, phase 11). Slice 1:
// the labelled vertical cross-section. Slice 2: the illustration ray
// overlay, rendered on both the cross-section and the globe from a single
// `generateIllustrationRays` call. Later slices (filter/colour/solo, term
// definitions, the link-budget breakdown) extend this file's `controls`/
// `canvas` in place, not by replacing its overall shape.
import { lazy, Suspense, useMemo } from 'react';
import { solarZenithAngleDeg } from '@core/domain/propagation/solarZenithAngle';
import SurfaceLayout from '../../components/layout/SurfaceLayout.tsx';
import { Panel, SegmentedControl, type SegmentedControlOption } from '../../components/v2/index.ts';
import GlobeDisplayPanel from '../../components/HfPropagationGlobe/GlobeDisplayPanel.tsx';
import type { GlobeToggles } from '../../state/globeToggles.ts';
import type { RayControlsState } from '../../state/rayControls.ts';
import {
  computeLayerStates,
  buildCoverageGridInput,
} from '../../components/reach/buildCoverageGridInput.ts';
import { haversineDistanceKm } from '../../lib/geo/bearingDistance.ts';
import { useThrottledConditions } from '../../hooks/useThrottledConditions.ts';
import { useViewerState } from '../../state/viewerState.tsx';
import RayOverlayControls from './RayOverlayControls.tsx';
import VerticalCrossSection from './VerticalCrossSection.tsx';
import { crossSectionLayerBands } from './crossSectionLayerBands.ts';
import { currentBearingDeg, selectPrimaryRay, useExploreRays } from './useExploreRays.ts';
import { rayOutcomeColouring } from './rayVisual.ts';
import classes from './ExplorePage.module.css';

// Lazy-loaded, same as Reach (F6.1's own AC) -- the three.js/react-globe.gl
// bundle only downloads once the operator switches to the globe view.
const HfPropagationGlobe = lazy(
  () => import('../../components/HfPropagationGlobe/HfPropagationGlobe.tsx'),
);

const VIEW_OPTIONS: SegmentedControlOption<'map' | 'globe'>[] = [
  { value: 'map', label: 'Cross-section' },
  { value: 'globe', label: 'Globe' },
];

/** Default cross-section/fan span (km) when there's no target to derive a real range from. */
const DEFAULT_EXPLORE_RANGE_KM = 4000;

export default function ExplorePage() {
  const { state, setState } = useViewerState();
  const { station, conditions, frequencyMhz, target } = state;
  const globeToggles = state.display.globeToggles;
  const rayControls = state.display.rayControls;

  // Same recompute-cadence fix Reach's own coverage/greyline/globe inputs
  // use (`useThrottledConditions`'s own doc comment) -- Explore's ray
  // regeneration is no cheaper than Reach's coverage sweep, so it inherits
  // the same throttle rather than re-deriving the fix.
  const throttledConditions = useThrottledConditions(conditions);

  const context = useMemo(
    () => buildCoverageGridInput(station, throttledConditions, frequencyMhz),
    [station, throttledConditions, frequencyMhz],
  );

  const layers = useMemo(
    () => computeLayerStates(station.qth, throttledConditions),
    [station.qth, throttledConditions],
  );

  // THE single generateIllustrationRays call this phase's own invariant
  // demands -- see useExploreRays.ts's own doc comment.
  const rays = useExploreRays(context, rayControls, target);
  const renderedRays = useMemo(() => rayOutcomeColouring(rays), [rays]);

  const bearingDeg = currentBearingDeg(station.qth, target, rayControls.focusBearingDeg);
  const primaryRay = useMemo(
    () => selectPrimaryRay(rays, bearingDeg, rayControls.elevationSpreadDeg),
    [rays, bearingDeg, rayControls.elevationSpreadDeg],
  );

  const solarZenithDeg = solarZenithAngleDeg(
    station.qth.lat,
    station.qth.lon,
    throttledConditions.atMs,
  );
  const bands = useMemo(
    () => crossSectionLayerBands(layers, solarZenithDeg),
    [layers, solarZenithDeg],
  );

  const targetRangeKm = target
    ? haversineDistanceKm(
        { latDeg: station.qth.lat, lonDeg: station.qth.lon },
        { latDeg: target.lat, lonDeg: target.lon },
      )
    : null;
  const maxRangeKm = targetRangeKm ?? DEFAULT_EXPLORE_RANGE_KM;

  const handleRayControlsChange = (next: RayControlsState) => {
    setState((prev) => ({ ...prev, display: { ...prev.display, rayControls: next } }));
  };

  const handleGlobeTogglesChange = (next: GlobeToggles) => {
    setState((prev) => ({ ...prev, display: { ...prev.display, globeToggles: next } }));
  };

  const handleMapModeChange = (mapMode: 'map' | 'globe') => {
    handleGlobeTogglesChange({ ...globeToggles, mapMode });
  };

  return (
    <SurfaceLayout
      controls={
        <div className={classes.controls}>
          <Panel title="View">
            <SegmentedControl
              options={VIEW_OPTIONS}
              value={globeToggles.mapMode}
              onChange={handleMapModeChange}
              aria-label="View"
            />
          </Panel>
          <RayOverlayControls
            value={rayControls}
            onChange={handleRayControlsChange}
            bearingLocked={target != null}
          />
          {globeToggles.mapMode === 'globe' ? (
            <GlobeDisplayPanel value={globeToggles} onChange={handleGlobeTogglesChange} />
          ) : null}
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
              txLat={station.qth.lat}
              txLon={station.qth.lon}
              coverageResult={null}
              cutawayEnabled={globeToggles.cutawayEnabled}
              sliceBearingDeg={bearingDeg}
              rays={renderedRays}
            />
          </Suspense>
        ) : (
          <VerticalCrossSection
            bands={bands}
            maxRangeKm={maxRangeKm}
            primaryRayPoints={primaryRay?.points ?? []}
            targetRangeKm={targetRangeKm}
            bearingDeg={bearingDeg}
            soloLayerId={rayControls.soloLayerId}
          />
        )
      }
    />
  );
}
