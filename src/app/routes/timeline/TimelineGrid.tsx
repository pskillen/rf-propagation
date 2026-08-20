/**
 * Timeline's 24-hour x band grid (F11.1/F11.2, [#73]/[#74]) — renders
 * `computeTimelineGrid`'s already-computed `TimelineCell[]` as a real
 * `<table>` (band rows x hour columns), never a second copy of the grid
 * math. Each cell is a clickable button (Slice 3, F11.2) that sets the
 * Conditions clock's hour-of-day to that column.
 *
 * Bucket colour scale: reuses `VerdictTable.module.css`'s own
 * good/marginal/unlikely palette (Path, phase 13) rather than inventing a
 * second one — grepped first for a shared `reliabilityColor(bucket)`
 * helper; Reach's own `cellFillStyle.ts` (phase 8) exists but is keyed on
 * `hopCount` (a different domain: coverage-grid cells, not a
 * `ReliabilityBucket`), so it isn't a drop-in fit here. Flagged in this
 * phase's PR description, per the plan file's own instruction.
 *
 * Mobile (F3.4, Slice 4): the hour axis scrolls horizontally
 * (`overflow-x: auto` on the wrapper); the band-label column is
 * `position: sticky; left: 0` so it stays visible while hours scroll —
 * see `TimelineGrid.module.css`.
 *
 * [#73]: https://github.com/pskillen/rf-propagation/issues/73
 * [#74]: https://github.com/pskillen/rf-propagation/issues/74
 */
import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import type { TimelineCell } from '@core/domain/propagation/timelineGrid';
import classes from './TimelineGrid.module.css';

export interface TimelineGridProps {
  cells: TimelineCell[];
  /** The UTC hour matching `conditions.atMs` right now — highlighted distinctly from selection (ux-and-ia.md §4.3: "the current time is marked"). */
  currentHourUtc: number;
  /** The UTC hour the operator last clicked, if any. */
  selectedHourUtc?: number;
  /** Fires with the clicked cell's hour-of-day (Slice 3, F11.2) — the caller sets `conditions.atMs`'s hour component, leaving the date unchanged. */
  onSelectHour: (hourUtc: number) => void;
}

const HOURS: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * "Ideally local time as a secondary label" (this phase's plan file,
 * flagged as a nice-to-have, not a hard requirement) — the operator's
 * OWN browser-local wall-clock hour that this UTC hour-of-day falls on,
 * via `Intl`'s default locale/timezone. Uses a fixed reference date
 * (this grid never spans a DST boundary within a single column, and the
 * exact calendar day doesn't matter for an hour-only label).
 */
function localHourLabel(hourUtc: number): string {
  const reference = new Date(Date.UTC(2000, 0, 1, hourUtc));
  return reference.toLocaleTimeString(undefined, { hour: 'numeric', hour12: false });
}

function formatUtcHour(hourUtc: number): string {
  return `${String(hourUtc).padStart(2, '0')}z`;
}

export default function TimelineGrid({
  cells,
  currentHourUtc,
  selectedHourUtc,
  onSelectHour,
}: TimelineGridProps) {
  const cellByBandAndHour = new Map<string, TimelineCell>();
  for (const cell of cells) {
    cellByBandAndHour.set(`${cell.bandId}:${cell.hourUtc}`, cell);
  }

  return (
    <div className={classes.scroll}>
      <table className={classes.table} aria-label="24-hour band-by-band reliability grid">
        <thead>
          <tr>
            <th className={classes.cornerHeader} scope="col">
              Band
            </th>
            {HOURS.map((hourUtc) => (
              <th
                key={hourUtc}
                scope="col"
                className={[
                  classes.hourHeader,
                  hourUtc === currentHourUtc ? classes.currentHour : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className={classes.hourUtc}>{formatUtcHour(hourUtc)}</span>
                <span className={classes.hourLocal}>{localHourLabel(hourUtc)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {UK_AMATEUR_BANDS.map((band) => (
            <tr key={band.id}>
              <th scope="row" className={classes.bandLabel}>
                {band.label}
              </th>
              {HOURS.map((hourUtc) => {
                const cell = cellByBandAndHour.get(`${band.id}:${hourUtc}`);
                const selected = selectedHourUtc === hourUtc;
                const current = hourUtc === currentHourUtc;
                return (
                  <td key={hourUtc} className={classes.cellWrap}>
                    {cell ? (
                      <button
                        type="button"
                        className={[
                          classes.cellButton,
                          classes[`cell-${cell.bucket}`],
                          current ? classes.currentHour : '',
                          selected ? classes.selected : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => onSelectHour(hourUtc)}
                        aria-label={`${band.label} at ${formatUtcHour(hourUtc)} — ${cell.bucket}, ${Math.round(
                          cell.reliability * 100,
                        )}% reliability`}
                        aria-pressed={selected}
                      />
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
