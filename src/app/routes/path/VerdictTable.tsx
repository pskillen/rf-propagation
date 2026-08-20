/**
 * Path's band x mode verdict table (F10.2, [#70]) — renders
 * `buildVerdictTable`'s already-ranked `VerdictRow[]` as a stacked-card
 * list (each band a flex-wrapping row, never a literal `<table>`), so it
 * stays readable at 360px width without a horizontal scroll (FR-23 names
 * this surface specifically as a mobile-first constraint, not a
 * nice-to-have deferred to a later phase).
 *
 * Each cell renders `ModeVerdict.bucket` + `.marginDb` + `.reliability`
 * as a percentage — never a bare boolean, per the engine's own public
 * surface (phase 3's own invariant, inherited here by construction since
 * `ModeVerdict` has no boolean field to accidentally render).
 *
 * Each row opens into F8.5's "explain this" (phase 11's
 * `ExplainThisLink`), imported directly rather than re-implementing
 * navigation-to-Explore.
 *
 * [#70]: https://github.com/pskillen/rf-propagation/issues/70
 */
import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import type { VerdictRow } from '@core/domain/propagation/verdictTable';
import ExplainThisLink from '../../components/ExplainThis/ExplainThisLink.tsx';
import TermDefinition from '../../components/TermDefinition/TermDefinition.tsx';
import type { Target } from '../../state/viewerState.tsx';
import classes from './VerdictTable.module.css';

const MODE_LABELS: Record<string, string> = {
  ssb: 'SSB',
  cw: 'CW',
  ft8: 'FT8',
  wspr: 'WSPR',
};

function formatMarginDb(marginDb: number): string {
  return `${marginDb >= 0 ? '+' : ''}${marginDb.toFixed(1)} dB`;
}

function formatReliabilityPct(reliability: number): string {
  return `${Math.round(reliability * 100)}%`;
}

export interface VerdictTableProps {
  rows: VerdictRow[];
  target: Target;
}

export default function VerdictTable({ rows, target }: VerdictTableProps) {
  if (rows.length === 0) {
    return <p>No bands to evaluate — check the Station&apos;s licence class or antenna set-up.</p>;
  }

  return (
    <ul className={classes.root} aria-label="Band by band verdict, ranked best-first">
      {rows.map((row) => {
        const bandLabel = UK_AMATEUR_BANDS.find((b) => b.id === row.bandId)?.label ?? row.bandId;
        return (
          <li key={row.bandId} className={classes.row}>
            <span className={classes.bandLabel}>{bandLabel}</span>
            {row.hopSolveResult.kind === 'unreachable' ? (
              <span className={classes.unreachable}>
                No hop geometry reaches this target on this band.
              </span>
            ) : (
              <span className={classes.cells}>
                {row.verdicts.map((verdict) => (
                  <span
                    key={verdict.mode}
                    className={`${classes.cell} ${classes[`cell-${verdict.bucket}`]}`}
                  >
                    <span className={classes.modeLabel}>
                      {MODE_LABELS[verdict.mode] ?? verdict.mode}
                    </span>
                    <TermDefinition term="snrMargin">
                      {formatMarginDb(verdict.marginDb)}
                    </TermDefinition>
                    <TermDefinition term="reliability">
                      {formatReliabilityPct(verdict.reliability)}
                    </TermDefinition>
                  </span>
                ))}
              </span>
            )}
            <span className={classes.explain}>
              <ExplainThisLink target={target} bandId={row.bandId} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
