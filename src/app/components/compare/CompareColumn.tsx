/**
 * One side of a no-target comparison (F9.1) — a label naming exactly
 * what this side is ("Current" / "12 m dipole" / "20m" / a timestamp,
 * depending on which field Compare is varying), Reach's own
 * coverage-surface map (`ReachMap`, phase 8) rendered read-only (drag
 * and click are no-ops here — Compare never changes `station.qth` or
 * sets a target itself, per this phase's own "no target picker" and
 * "everything else held identical" scope notes), and a plain-language
 * reach-extremes line reusing `reachSummary.ts`'s existing
 * `formatReachExtremes`.
 */
import type { Station } from '@core/domain/station/types';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import ReachMap from '../reach/ReachMap.tsx';
import type { CoveragePass } from '../reach/useReachCoverage.ts';
import { formatReachExtremes, reachExtremes } from '../reach/reachSummary.ts';
import classes from './CompareColumn.module.css';

const NOOP_LATLON = () => {};

export interface CompareColumnProps {
  label: string;
  /** The shared `Station` (qth is identical on both sides — only `ReachMap`'s marker position/center is read from it here). */
  station: Station;
  coverageResult: CoverageGridResult | null;
  coveragePass: CoveragePass | null;
  atMs: number;
}

export default function CompareColumn({
  label,
  station,
  coverageResult,
  coveragePass,
  atMs,
}: CompareColumnProps) {
  const summary = coverageResult
    ? formatReachExtremes(reachExtremes(coverageResult))
    : 'Computing coverage…';

  return (
    <div className={classes.root}>
      <p className={classes.label}>{label}</p>
      <p className={classes.summary}>{summary}</p>
      <div className={classes.mapWrap}>
        <ReachMap
          station={station}
          onStationDrag={NOOP_LATLON}
          onStationDragEnd={NOOP_LATLON}
          coverageResult={coverageResult}
          coveragePass={coveragePass}
          coverageStation={station.qth}
          target={null}
          onMapClick={NOOP_LATLON}
          atMs={atMs}
          showTerminator={false}
        />
      </div>
    </div>
  );
}
