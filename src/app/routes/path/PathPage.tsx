/**
 * Path — "can I work that station" (F10, phase 13), the second half of
 * FR-14's "my area" vs "a location" distinction. Slice 1: the target
 * picker (empty state, when `target` is `null` — this is how an operator
 * sets a target from Path itself, distinct from Reach's own F5.5
 * cell-click door). Slice 2: the band x mode verdict table, ranked
 * best-first. Slice 3: the geometry summary + antenna angle check for
 * whichever row is selected (best band by default). Slice 4: the
 * canvas reuses Explore's own `useExploreRays`/`VerticalCrossSection`
 * (phase 11) rather than a second illustration-ray pipeline — Path's
 * canvas is a side-on profile of the great-circle path with hop bounces,
 * which `VerticalCrossSection` already renders, fan-mode rays included.
 *
 * This phase adds no engine code: every number here comes from
 * `solveHopsForDistance` + `computeLinkBudget` + `modeVerdict`, called
 * once per band via `buildVerdictTable` (phase 4/core's own public
 * surface), exactly as Reach/Explore/Compare already do.
 */
import { useMemo, useState } from 'react';
import { UK_AMATEUR_BANDS, bandMidpointMhz } from '@core/domain/bandCatalog';
import { destinationPoint } from '@core/domain/propagation/greatCircle';
import { solarZenithAngleDeg } from '@core/domain/propagation/solarZenithAngle';
import type { SolveHopsContext } from '@core/domain/propagation/multiHop';
import { buildVerdictTable } from '@core/domain/propagation/verdictTable';
import SurfaceLayout from '../../components/layout/SurfaceLayout.tsx';
import { Panel } from '../../components/v2/index.ts';
import {
  computeLayerStates,
  buildCoverageGridInput,
} from '../../components/reach/buildCoverageGridInput.ts';
import { haversineDistanceKm, initialBearingDeg } from '../../lib/geo/bearingDistance.ts';
import { useThrottledConditions } from '../../hooks/useThrottledConditions.ts';
import { useViewerState, type Target } from '../../state/viewerState.tsx';
import { crossSectionLayerBands } from '../explore/crossSectionLayerBands.ts';
import VerticalCrossSection from '../explore/VerticalCrossSection.tsx';
import { selectPrimaryRay, useExploreRays } from '../explore/useExploreRays.ts';
import { applyRayVisuals } from '../explore/rayVisual.ts';
import TargetPicker from './TargetPicker.tsx';
import VerdictTable from './VerdictTable.tsx';
import GeometrySummary from './GeometrySummary.tsx';
import classes from './PathPage.module.css';

/** Cross-section span (km) shown while no target is set -- kept in sync with Explore's own default. */
const DEFAULT_PATH_RANGE_KM = 4000;

export default function PathPage() {
  const { state, setState } = useViewerState();
  const { station, conditions, frequencyMhz, target } = state;
  const rayControls = state.display.rayControls;
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);

  const throttledConditions = useThrottledConditions(conditions);

  const activeAntenna =
    station.antennas.find((antenna) => antenna.id === station.activeAntennaId) ??
    station.antennas[0]!;

  const context = useMemo(
    () => buildCoverageGridInput(station, throttledConditions, frequencyMhz),
    [station, throttledConditions, frequencyMhz],
  );
  const layers = useMemo(
    () => computeLayerStates(station.qth, throttledConditions),
    [station.qth, throttledConditions],
  );

  const targetRangeKm = target
    ? haversineDistanceKm(
        { latDeg: station.qth.lat, lonDeg: station.qth.lon },
        { latDeg: target.lat, lonDeg: target.lon },
      )
    : null;
  const bearingDeg = target
    ? initialBearingDeg(
        { latDeg: station.qth.lat, lonDeg: station.qth.lon },
        { latDeg: target.lat, lonDeg: target.lon },
      )
    : 0;

  // Same solveContext-building pattern ExplorePage.tsx's own link-budget
  // breakdown and ComparePage.tsx's own buildSideVerdicts already use --
  // this phase does not add a second one.
  const solveContext: SolveHopsContext | null = useMemo(() => {
    if (targetRangeKm == null) return null;
    return {
      ssn: context.ssn,
      groundType: context.groundType,
      noiseEnvironment: context.noiseEnvironment,
      txPowerW: context.txPowerW,
      txAntennaGainDbi: activeAntenna.gainDbi,
      rxAntennaGainDbi: context.rxAntennaGainDbi,
      bandwidthHz: context.bandwidthHz,
      solarZenithAtMidpointDeg: (hopIndex, hopCount) => {
        const midDistanceKm = (targetRangeKm * (hopIndex + 0.5)) / hopCount;
        const midpoint = destinationPoint(
          { latDeg: station.qth.lat, lonDeg: station.qth.lon },
          bearingDeg,
          midDistanceKm,
        );
        return solarZenithAngleDeg(midpoint.latDeg, midpoint.lonDeg, throttledConditions.atMs);
      },
    };
  }, [targetRangeKm, station.qth, bearingDeg, throttledConditions, context, activeAntenna]);

  const rows = useMemo(() => {
    if (!solveContext || targetRangeKm == null) return [];
    return buildVerdictTable(UK_AMATEUR_BANDS, targetRangeKm, layers, solveContext);
  }, [solveContext, targetRangeKm, layers]);

  const effectiveSelectedBandId = selectedBandId ?? rows[0]?.bandId ?? null;
  const selectedRow = rows.find((row) => row.bandId === effectiveSelectedBandId) ?? null;
  const selectedFrequencyMhz = effectiveSelectedBandId
    ? bandMidpointMhz(effectiveSelectedBandId)
    : frequencyMhz;

  // Reuses Explore's own generateIllustrationRays call/hook (phase 11) --
  // mode: 'fan' once target is set, focused on this bearing, rather than
  // a second illustration-ray pipeline for Path's canvas.
  const rays = useExploreRays(context, rayControls, target);
  const renderedRays = useMemo(
    () => applyRayVisuals(rays, rayControls, context),
    [rays, rayControls, context],
  );
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
  const maxRangeKm = targetRangeKm ?? DEFAULT_PATH_RANGE_KM;

  function handleTargetChange(next: Target | null) {
    setState((prev) => ({ ...prev, target: next }));
    setSelectedBandId(null);
  }

  return (
    <SurfaceLayout
      controls={
        <div className={classes.controls}>
          <Panel title="Target">
            <TargetPicker
              station={station.qth}
              target={target}
              onTargetChange={handleTargetChange}
            />
          </Panel>
          {target && rows.length > 0 ? (
            <Panel title="Band by band">
              <VerdictTable
                rows={rows}
                target={target}
                selectedBandId={effectiveSelectedBandId ?? undefined}
                onSelectRow={setSelectedBandId}
              />
            </Panel>
          ) : null}
          {selectedRow && selectedRow.hopSolveResult.kind === 'solved' ? (
            <Panel title="Geometry">
              <GeometrySummary
                hopSolution={selectedRow.hopSolveResult.solution}
                station={station}
                activeAntenna={activeAntenna}
                bearingDeg={bearingDeg}
                frequencyMhz={selectedFrequencyMhz}
              />
            </Panel>
          ) : null}
        </div>
      }
      canvas={
        <div className={classes.canvas}>
          {target ? (
            <VerticalCrossSection
              bands={bands}
              maxRangeKm={maxRangeKm}
              rays={renderedRays.map((r) => ({
                points: r.ray.points,
                color: r.color,
                dimmed: r.dimmed,
              }))}
              primaryRayPoints={primaryRay?.points ?? []}
              targetRangeKm={targetRangeKm}
              bearingDeg={bearingDeg}
            />
          ) : (
            <p className={classes.empty}>
              Set a target above to see the great-circle path, hop-by-hop, and the band-by-band
              verdict.
            </p>
          )}
        </div>
      }
    />
  );
}
