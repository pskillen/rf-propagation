// Compare — change-one-thing-and-see, made explicit and shareable (F9,
// phase 12). Slice 1: the two-configuration side-by-side shell (antenna/
// band/time, one varied at a time, everything else — qth, power, noise,
// conditions driver/ground, target — held identical). Slice 2: the dB
// delta presentation for a target-set scenario, and the plain-km delta
// for the no-target coverage-surface case. This phase adds no engine
// code — every number here comes from calling `computeCoverageGrid`/
// `solveHopsForDistance`/`computeLinkBudget`/`modeVerdict` exactly as
// Reach (phase 8) and Explore (phase 11) already do, once per side.
import { useCallback, useMemo } from 'react';
import { UK_AMATEUR_BANDS, bandMidpointMhz } from '@core/domain/bandCatalog';
import type { Station } from '@core/domain/station/types';
import type { Conditions } from '@core/domain/conditions/types';
import { destinationPoint } from '@core/domain/propagation/greatCircle';
import { solarZenithAngleDeg } from '@core/domain/propagation/solarZenithAngle';
import { solveHopsForDistance, type SolveHopsContext } from '@core/domain/propagation/multiHop';
import { modeVerdict, type ModeVerdict } from '@core/domain/propagation/reliability';
import type { Mode } from '@core/domain/propagation/modes';
import {
  computeCompareDeltas,
  deriveCompareSides,
  DEFAULT_COMPARE_STATE,
  type CompareState,
} from '@core/domain/propagation/compareScenario';
import { haversineDistanceKm, initialBearingDeg } from '../../lib/geo/bearingDistance.ts';
import SurfaceLayout from '../../components/layout/SurfaceLayout.tsx';
import { Panel, StatusBanner, ToggleSwitch } from '../../components/v2/index.ts';
import {
  computeLayerStates,
  buildCoverageGridInput,
} from '../../components/reach/buildCoverageGridInput.ts';
import { useReachCoverage } from '../../components/reach/useReachCoverage.ts';
import { reachExtremes } from '../../components/reach/reachSummary.ts';
import CompareAgainstPicker, {
  type CompareByField,
} from '../../components/compare/CompareAgainstPicker.tsx';
import CompareColumn from '../../components/compare/CompareColumn.tsx';
import CompareVerdictTable from '../../components/compare/CompareVerdictTable.tsx';
import {
  computeCoverageReachDelta,
  type CoverageReachDelta,
} from '../../components/compare/compareCoverageSummary.ts';
import { useViewerState } from '../../state/viewerState.tsx';
import classes from './ComparePage.module.css';

/** SSB/CW/FT8 — the phase file's own choice of modes for the target-set verdict table. */
const COMPARE_MODES: readonly Mode[] = ['ssb', 'cw', 'ft8'];

/**
 * A side's mode verdicts for the shared target, or `null` when there's
 * no target set at all (the no-target case uses `computeCoverageReachDelta`
 * instead — see this file's `canvas` rendering below). Follows the exact
 * `solveHopsForDistance` calling pattern `ExplorePage.tsx`'s own
 * link-budget-breakdown `useMemo` already establishes (phase 11) — this
 * phase does not add a second hop-search implementation.
 */
function buildSideVerdicts(
  sideStation: Station,
  sideConditions: Conditions,
  sideFrequencyMhz: number,
  targetRangeKm: number,
  bearingDeg: number,
): ModeVerdict[] {
  const activeAntenna =
    sideStation.antennas.find((antenna) => antenna.id === sideStation.activeAntennaId) ??
    sideStation.antennas[0]!;
  const layers = computeLayerStates(sideStation.qth, sideConditions);
  const context = buildCoverageGridInput(sideStation, sideConditions, sideFrequencyMhz);

  const solveContext: SolveHopsContext = {
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
        { latDeg: sideStation.qth.lat, lonDeg: sideStation.qth.lon },
        bearingDeg,
        midDistanceKm,
      );
      return solarZenithAngleDeg(midpoint.latDeg, midpoint.lonDeg, sideConditions.atMs);
    },
  };

  const solved = solveHopsForDistance(targetRangeKm, sideFrequencyMhz, layers, solveContext);
  if (solved.kind === 'unreachable') return [];

  return COMPARE_MODES.map((mode) =>
    modeVerdict(
      solved.solution.linkBudget.mufMhz,
      sideFrequencyMhz,
      solved.solution.linkBudget.snrDb2400,
      mode,
    ),
  );
}

function formatReachDelta(delta: CoverageReachDelta): string {
  const parts: string[] = [];
  if (delta.groundwaveMaxKmDeltaKm != null) {
    const sign = delta.groundwaveMaxKmDeltaKm >= 0 ? '+' : '';
    parts.push(`groundwave ${sign}${Math.round(delta.groundwaveMaxKmDeltaKm)} km`);
  }
  if (delta.firstHopMinKmDeltaKm != null) {
    const sign = delta.firstHopMinKmDeltaKm >= 0 ? '+' : '';
    parts.push(`first hop ${sign}${Math.round(delta.firstHopMinKmDeltaKm)} km`);
  }
  return parts.length > 0 ? parts.join(', ') : 'Not enough coverage yet to compare.';
}

function formatAgainstTimeLabel(atMs: number): string {
  return new Date(atMs).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Which `compare.against*` field is currently driving the "against" side — priority order matches `CompareAgainstPicker`'s own field order. */
function compareByFromState(compare: CompareState): CompareByField {
  if (compare.againstBandId !== undefined) return 'band';
  if (compare.againstAtMs !== undefined) return 'time';
  return 'antenna';
}

const DEFAULT_TIME_OFFSET_MS = 12 * 60 * 60 * 1000;

export default function ComparePage() {
  const { state, setState } = useViewerState();
  const { station, conditions, frequencyMhz, target, bandId } = state;
  const compare = state.compare;

  const sides = useMemo(() => deriveCompareSides(state), [state]);
  const compareBy = compareByFromState(compare);

  const rightStation: Station = useMemo(
    () => ({ ...station, activeAntennaId: sides.right.antennaId }),
    [station, sides.right.antennaId],
  );
  const rightConditions: Conditions = useMemo(
    () =>
      sides.right.atMs === conditions.atMs ? conditions : { ...conditions, atMs: sides.right.atMs },
    [conditions, sides.right.atMs],
  );
  const rightFrequencyMhz =
    sides.right.bandId === bandId ? frequencyMhz : bandMidpointMhz(sides.right.bandId);

  // Two independent Worker clients, one per side -- same public
  // `useReachCoverage` hook Reach (phase 8) already uses, called twice
  // with the "against" side's antenna/band/time substituted, per this
  // phase's own "calls the engine twice with one input changed" invariant.
  const leftCoverage = useReachCoverage(station, conditions, frequencyMhz);
  const rightCoverage = useReachCoverage(rightStation, rightConditions, rightFrequencyMhz);

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

  const leftVerdicts = useMemo(
    () =>
      targetRangeKm == null
        ? null
        : buildSideVerdicts(station, conditions, frequencyMhz, targetRangeKm, bearingDeg),
    [station, conditions, frequencyMhz, targetRangeKm, bearingDeg],
  );
  const rightVerdicts = useMemo(
    () =>
      targetRangeKm == null
        ? null
        : buildSideVerdicts(
            rightStation,
            rightConditions,
            rightFrequencyMhz,
            targetRangeKm,
            bearingDeg,
          ),
    [rightStation, rightConditions, rightFrequencyMhz, targetRangeKm, bearingDeg],
  );
  const deltas = useMemo(
    () => (leftVerdicts && rightVerdicts ? computeCompareDeltas(leftVerdicts, rightVerdicts) : []),
    [leftVerdicts, rightVerdicts],
  );

  const reachDelta = useMemo(
    () =>
      computeCoverageReachDelta(
        leftCoverage.result ? reachExtremes(leftCoverage.result) : [],
        rightCoverage.result ? reachExtremes(rightCoverage.result) : [],
      ),
    [leftCoverage.result, rightCoverage.result],
  );

  const rightAntenna =
    rightStation.antennas.find((antenna) => antenna.id === sides.right.antennaId) ??
    rightStation.antennas[0];
  const rightBandLabel =
    UK_AMATEUR_BANDS.find((band) => band.id === sides.right.bandId)?.label ?? sides.right.bandId;
  const rightLabel =
    compareBy === 'antenna'
      ? (rightAntenna?.name ?? 'Against')
      : compareBy === 'band'
        ? rightBandLabel
        : formatAgainstTimeLabel(sides.right.atMs);

  const handleToggleCompare = useCallback(
    (enabled: boolean) => {
      setState((prev) => {
        if (!enabled) return { ...prev, compare: { ...DEFAULT_COMPARE_STATE, enabled: false } };
        // "Duplicating the current configuration and changing one thing
        // takes one interaction" (F9.1) -- the common two-antenna case
        // gets a sensible default already picked; anything else starts
        // as an identical, zero-delta comparison the operator then edits.
        if (prev.station.antennas.length === 2) {
          const other = prev.station.antennas.find(
            (antenna) => antenna.id !== prev.station.activeAntennaId,
          );
          return {
            ...prev,
            compare: {
              enabled: true,
              againstAntennaId: other?.id,
              againstBandId: undefined,
              againstAtMs: undefined,
            },
          };
        }
        return { ...prev, compare: { ...prev.compare, enabled: true } };
      });
    },
    [setState],
  );

  const handleCompareByChange = useCallback(
    (field: CompareByField) => {
      setState((prev) => {
        const next: CompareState = {
          enabled: true,
          againstAntennaId: undefined,
          againstBandId: undefined,
          againstAtMs: undefined,
        };
        if (field === 'antenna') {
          const other = prev.station.antennas.find(
            (antenna) => antenna.id !== prev.station.activeAntennaId,
          );
          next.againstAntennaId = other?.id ?? prev.station.activeAntennaId;
        } else if (field === 'band') {
          const other = UK_AMATEUR_BANDS.find((band) => band.id !== prev.bandId);
          next.againstBandId = other?.id ?? prev.bandId;
        } else {
          next.againstAtMs = prev.conditions.atMs + DEFAULT_TIME_OFFSET_MS;
        }
        return { ...prev, compare: next };
      });
    },
    [setState],
  );

  const handleAgainstAntennaChange = useCallback(
    (antennaId: string) => {
      setState((prev) => ({
        ...prev,
        compare: {
          enabled: true,
          againstAntennaId: antennaId,
          againstBandId: undefined,
          againstAtMs: undefined,
        },
      }));
    },
    [setState],
  );

  const handleAgainstBandChange = useCallback(
    (nextBandId: string) => {
      setState((prev) => ({
        ...prev,
        compare: {
          enabled: true,
          againstAntennaId: undefined,
          againstBandId: nextBandId,
          againstAtMs: undefined,
        },
      }));
    },
    [setState],
  );

  const handleAgainstAtMsChange = useCallback(
    (atMs: number) => {
      setState((prev) => ({
        ...prev,
        compare: {
          enabled: true,
          againstAntennaId: undefined,
          againstBandId: undefined,
          againstAtMs: atMs,
        },
      }));
    },
    [setState],
  );

  return (
    <SurfaceLayout
      controls={
        <div className={classes.controls}>
          <Panel title="Compare">
            <ToggleSwitch
              checked={compare.enabled}
              onChange={handleToggleCompare}
              label="Compare"
            />
            {compare.enabled ? (
              <CompareAgainstPicker
                compareBy={compareBy}
                onCompareByChange={handleCompareByChange}
                antennas={station.antennas}
                currentAntennaId={station.activeAntennaId}
                againstAntennaId={sides.right.antennaId}
                onAgainstAntennaChange={handleAgainstAntennaChange}
                currentBandId={bandId}
                againstBandId={sides.right.bandId}
                onAgainstBandChange={handleAgainstBandChange}
                currentAtMs={conditions.atMs}
                againstAtMs={sides.right.atMs}
                onAgainstAtMsChange={handleAgainstAtMsChange}
              />
            ) : (
              <StatusBanner tone="info">
                Enable Compare to see two configurations side by side — same station and conditions,
                one antenna, band or time varied.
              </StatusBanner>
            )}
          </Panel>
        </div>
      }
      canvas={
        !compare.enabled ? (
          <div className={classes.disabledNote}>
            <p>Turn on Compare to see the difference one change makes.</p>
          </div>
        ) : target ? (
          <div className={classes.verdictWrap}>
            <CompareVerdictTable
              deltas={deltas}
              leftLabel="Current"
              rightLabel={rightLabel}
              explainTarget={target}
              bandId={bandId}
            />
          </div>
        ) : (
          <div className={classes.columns}>
            <CompareColumn
              label="Current"
              station={station}
              coverageResult={leftCoverage.result}
              coveragePass={leftCoverage.pass}
              atMs={conditions.atMs}
            />
            <CompareColumn
              label={rightLabel}
              station={rightStation}
              coverageResult={rightCoverage.result}
              coveragePass={rightCoverage.pass}
              atMs={rightConditions.atMs}
            />
            <p className={classes.reachDeltaLine}>{formatReachDelta(reachDelta)}</p>
          </div>
        )
      }
    />
  );
}
