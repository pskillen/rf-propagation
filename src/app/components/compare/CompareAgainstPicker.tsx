/**
 * The "against" side's single varied-field picker (F9.1, [#69]) —
 * "duplicating the current configuration and changing one thing takes
 * one interaction": a "Compare by" selector (antenna / band / time) that
 * then exposes only the one relevant "against" field, reusing existing
 * pickers (`BandChips` for band, a plain antenna list for antenna, a
 * Mantine `Slider` for time — the same direct-manipulation pattern
 * `TimeScrubber.tsx` already establishes) rather than inventing new
 * input widgets, per this phase's own "no new antenna/band/time input
 * widgets beyond what F9.1 needs" scope note.
 */
import { Slider } from '@mantine/core';
import type { AntennaConfig } from '@core/domain/station/types';
import BandChips from '../conditions/BandChips.tsx';
import { SegmentedControl, type SegmentedControlOption } from '../v2/index.ts';
import classes from './CompareAgainstPicker.module.css';

export type CompareByField = 'antenna' | 'band' | 'time';

const COMPARE_BY_OPTIONS: SegmentedControlOption<CompareByField>[] = [
  { value: 'antenna', label: 'Antenna' },
  { value: 'band', label: 'Band' },
  { value: 'time', label: 'Time' },
];

const AGAINST_TIME_HALF_SPAN_MS = 48 * 60 * 60 * 1000;

function formatAgainstTime(atMs: number): string {
  return new Date(atMs).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface CompareAgainstPickerProps {
  compareBy: CompareByField;
  onCompareByChange: (field: CompareByField) => void;
  antennas: AntennaConfig[];
  currentAntennaId: string;
  againstAntennaId: string;
  onAgainstAntennaChange: (antennaId: string) => void;
  currentBandId: string;
  againstBandId: string;
  onAgainstBandChange: (bandId: string) => void;
  currentAtMs: number;
  againstAtMs: number;
  onAgainstAtMsChange: (atMs: number) => void;
}

export default function CompareAgainstPicker({
  compareBy,
  onCompareByChange,
  antennas,
  currentAntennaId,
  againstAntennaId,
  onAgainstAntennaChange,
  currentBandId,
  againstBandId,
  onAgainstBandChange,
  currentAtMs,
  againstAtMs,
  onAgainstAtMsChange,
}: CompareAgainstPickerProps) {
  return (
    <div className={classes.root}>
      <SegmentedControl
        options={COMPARE_BY_OPTIONS}
        value={compareBy}
        onChange={onCompareByChange}
        aria-label="Compare by"
      />

      {compareBy === 'antenna' ? (
        <div className={classes.antennaList} role="group" aria-label="Against antenna">
          {antennas
            .filter((antenna) => antenna.id !== currentAntennaId)
            .map((antenna) => (
              <button
                key={antenna.id}
                type="button"
                className={[
                  classes.antennaButton,
                  antenna.id === againstAntennaId ? classes.antennaButtonSelected : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={antenna.id === againstAntennaId}
                onClick={() => onAgainstAntennaChange(antenna.id)}
              >
                {antenna.name} &middot; {antenna.heightM} m
              </button>
            ))}
          {antennas.length <= 1 ? (
            <p className={classes.emptyNote}>
              Add another antenna in Station to compare by antenna.
            </p>
          ) : null}
        </div>
      ) : null}

      {compareBy === 'band' ? (
        <BandChips bandId={againstBandId} onChange={onAgainstBandChange} />
      ) : null}

      {compareBy === 'time' ? (
        <div className={classes.timeRow}>
          <span className={classes.timeLabel}>{formatAgainstTime(againstAtMs)}</span>
          <Slider
            thumbLabel="Against time"
            value={againstAtMs}
            min={currentAtMs - AGAINST_TIME_HALF_SPAN_MS}
            max={currentAtMs + AGAINST_TIME_HALF_SPAN_MS}
            step={60_000}
            label={(value) => formatAgainstTime(value)}
            onChange={onAgainstAtMsChange}
          />
        </div>
      ) : null}

      {compareBy === 'band' && againstBandId === currentBandId ? (
        <p className={classes.emptyNote}>Pick a different band to compare against.</p>
      ) : null}
    </div>
  );
}
