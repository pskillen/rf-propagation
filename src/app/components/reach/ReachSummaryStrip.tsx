// Best-band-now summary strip (F5.4, Slice 4) -- two related but distinct
// numbers (ux-and-ia.md §4.1's own "Summary strip" bullet): the current
// band's own reach extremes (from the already-computed CoverageGridResult,
// no extra engine call), and the best band right now ranked across the
// operator's whole amateur catalogue (useBestBandNow, Slice 4). "Every
// figure carries its reliability percentage; no bare booleans" (FR-9) --
// the best-band figure always shows its % alongside the band id.
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import { formatReachExtremes, reachExtremes, type BandRanking } from './reachSummary.ts';
import classes from './ReachSummaryStrip.module.css';

export interface ReachSummaryStripProps {
  /** The CURRENT band's coverage grid (Slice 2) -- reach extremes are read off this directly, no separate computation. */
  coverageResult: CoverageGridResult | null;
  /** Ranked bands from useBestBandNow (Slice 4) -- empty while the sweep is still running. */
  bandRankings: BandRanking[];
}

function bandLabel(bandId: string): string {
  return UK_AMATEUR_BANDS.find((band) => band.id === bandId)?.label ?? bandId;
}

export default function ReachSummaryStrip({
  coverageResult,
  bandRankings,
}: ReachSummaryStripProps) {
  const extremesSummary = coverageResult
    ? formatReachExtremes(reachExtremes(coverageResult))
    : 'Computing coverage…';

  const best = bandRankings[0];

  return (
    <div className={classes.root} aria-label="Reach summary">
      <p className={classes.line}>
        <span className={classes.label}>This band:</span> {extremesSummary}
      </p>
      <p className={classes.line}>
        <span className={classes.label}>Best band now:</span>{' '}
        {best ? (
          <>
            {bandLabel(best.bandId)} &middot; {Math.round(best.meanReliability * 100)}% reliability
          </>
        ) : (
          'Ranking bands…'
        )}
      </p>
    </div>
  );
}
