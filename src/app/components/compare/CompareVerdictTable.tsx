/**
 * The target-set delta view (F9.2, [#75]) — a compact, independently-
 * built two-column table, NOT a port of Path's eventual verdict table
 * (`VerdictTable.tsx`, F10.2, phase 13 — doesn't exist yet, see this
 * phase's plan file's own Context section). "The difference is called
 * out in dB, not left for the operator to subtract" — `deltaDb` renders
 * explicitly next to each mode's two margins, with a sign and a colour
 * cue for which side improved.
 */
import type { ReliabilityBucket } from '@core/domain/propagation/reliability';
import type { CompareDelta } from '@core/domain/propagation/compareScenario';
import type { Target } from '../../state/viewerState.tsx';
import TermDefinition from '../TermDefinition/TermDefinition.tsx';
import ExplainThisLink from '../ExplainThis/ExplainThisLink.tsx';
import classes from './CompareVerdictTable.module.css';

const MODE_LABELS: Record<string, string> = {
  ssb: 'SSB',
  cw: 'CW',
  ft8: 'FT8',
  wspr: 'WSPR',
};

const BUCKET_LABELS: Record<ReliabilityBucket, string> = {
  good: 'Good',
  marginal: 'Marginal',
  unlikely: 'Unlikely',
};

function formatMarginDb(marginDb: number): string {
  return `${marginDb >= 0 ? '+' : ''}${marginDb.toFixed(1)} dB`;
}

function formatDeltaDb(deltaDb: number): string {
  const sign = deltaDb > 0 ? '+' : '';
  return `${sign}${deltaDb.toFixed(1)} dB`;
}

export interface CompareVerdictTableProps {
  deltas: CompareDelta[];
  leftLabel: string;
  rightLabel: string;
  explainTarget?: Target;
  bandId: string;
}

export default function CompareVerdictTable({
  deltas,
  leftLabel,
  rightLabel,
  explainTarget,
  bandId,
}: CompareVerdictTableProps) {
  return (
    <table className={classes.root} aria-label="Verdict comparison">
      <thead>
        <tr>
          <th scope="col">Mode</th>
          <th scope="col">{leftLabel}</th>
          <th scope="col">{rightLabel}</th>
          <th scope="col">
            <TermDefinition term="snrMargin">Delta</TermDefinition>
          </th>
        </tr>
      </thead>
      <tbody>
        {deltas.map((delta) => (
          <tr key={delta.mode}>
            <th scope="row">{MODE_LABELS[delta.mode] ?? delta.mode.toUpperCase()}</th>
            <td className={classes[`bucket-${delta.leftBucket}`]}>
              {formatMarginDb(delta.leftMarginDb)}
              <span className={classes.bucketLabel}> ({BUCKET_LABELS[delta.leftBucket]})</span>
            </td>
            <td className={classes[`bucket-${delta.rightBucket}`]}>
              {formatMarginDb(delta.rightMarginDb)}
              <span className={classes.bucketLabel}> ({BUCKET_LABELS[delta.rightBucket]})</span>
            </td>
            <td
              className={[
                classes.delta,
                delta.deltaDb >= 0 ? classes.deltaUp : classes.deltaDown,
              ].join(' ')}
            >
              {delta.deltaDb >= 0 ? '\u2191' : '\u2193'} {formatDeltaDb(delta.deltaDb)}
            </td>
          </tr>
        ))}
      </tbody>
      {explainTarget ? (
        <tfoot>
          <tr>
            <td colSpan={4}>
              <ExplainThisLink target={explainTarget} bandId={bandId} />
            </td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}
