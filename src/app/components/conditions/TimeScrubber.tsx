// Bespoke drag-first time control (F4.6) — a Mantine Slider (same
// direct-manipulation-primary pattern PercentLevelSlider already
// establishes for this kit, `../v2/PercentLevelSlider.tsx`), not a native
// `<input type="datetime-local">` picker. A datetime-local fallback still
// exists alongside it for precise entry, per the "direct manipulation
// primary, field secondary" pattern Station's QTH picker and antenna
// heading already establish.
//
// Judgment call, flagged: the slider spans ±48h around the moment this
// component renders — neither doc specifies scrub bounds, this is this
// phase's own reasonable default.
//
// Note explicitly: dragging this control cannot yet make "the world"
// visibly respond (FR-27) — no surface reads Conditions yet (phase 8 is
// the first). This component only guarantees the control itself is
// scrub-first.
import { Slider } from '@mantine/core';
import { useState } from 'react';
import { FormField, ToggleSwitch } from '../v2/index.ts';
import classes from './TimeScrubber.module.css';

const SCRUB_RANGE_HALF_SPAN_MS = 48 * 60 * 60 * 1000;

function toDatetimeLocalValue(atMs: number): string {
  const d = new Date(atMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): number | undefined {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatScrubberLabel(atMs: number): string {
  return new Date(atMs).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface TimeScrubberProps {
  atMs: number;
  liveNow: boolean;
  /** Fired on every drag tick — the visible value, no debounce. */
  onScrub: (atMs: number) => void;
  onGoLive: () => void;
}

export default function TimeScrubber({ atMs, liveNow, onScrub, onGoLive }: TimeScrubberProps) {
  // Anchored once at mount via a lazy `useState` initializer, rather than
  // calling `Date.now()` directly during render (impure — React's render
  // purity rule flags that even though this component re-renders roughly
  // once a second while live). The range drifting by however long this
  // component happens to stay mounted is imperceptible for a ±48h bound.
  const [anchorNowMs] = useState(() => Date.now());
  const min = anchorNowMs - SCRUB_RANGE_HALF_SPAN_MS;
  const max = anchorNowMs + SCRUB_RANGE_HALF_SPAN_MS;
  const sliderValue = Math.min(max, Math.max(min, atMs));

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <span className={classes.label}>{formatScrubberLabel(atMs)}</span>
        <ToggleSwitch
          checked={liveNow}
          onChange={(checked) => {
            if (checked) onGoLive();
          }}
          label="Live now"
          aria-label="Live now"
        />
      </div>
      <Slider
        thumbLabel="Scrub time"
        value={sliderValue}
        min={min}
        max={max}
        step={60_000}
        label={(value) => formatScrubberLabel(value)}
        onChange={(value) => onScrub(value)}
      />
      <FormField label="Exact time">
        <input
          type="datetime-local"
          className={classes.datetimeInput}
          aria-label="Exact time"
          value={toDatetimeLocalValue(atMs)}
          onChange={(event) => {
            const parsed = fromDatetimeLocalValue(event.target.value);
            if (parsed !== undefined) onScrub(parsed);
          }}
        />
      </FormField>
    </div>
  );
}
