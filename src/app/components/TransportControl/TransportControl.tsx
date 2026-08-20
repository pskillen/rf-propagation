// Persistent transport control (F7.1, phase 10's Slice 1) — mounted once
// in the shared chrome (`AppChrome`'s `transportControl` slot), not
// inside any one surface, so "works on every surface, not only the
// globe" is true by construction. Drives `Conditions.atMs` the same way
// a manual scrub does (via the shared `onScrub` callback lifted to
// `App.tsx`'s `Shell` -- see `viewerState.tsx`'s phase-10 CORRECTION
// note), so Reach's/Globe's already-reactive coverage-grid/shell
// recompute (phases 8/9) picks up every playback tick for free -- this
// component does not touch either surface directly.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Slider } from '@mantine/core';
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import {
  PLAYBACK_SPEED_OPTIONS,
  playbackFrameDeltaMs,
  type PlaybackState,
} from '../../state/playback.ts';
import { Button, SegmentedControl, type SegmentedControlOption } from '../v2/index.ts';
import classes from './TransportControl.module.css';

// Judgment call: same ±48h span as ConditionsBar's own TimeScrubber
// (`../conditions/TimeScrubber.tsx`) -- this control's scrub slider is a
// second, chrome-level entry point to the same `atMs`, not a
// differently-scoped one.
const SCRUB_RANGE_HALF_SPAN_MS = 48 * 60 * 60 * 1000;

// A single rAF tick pausing (background tab, GC pause, breakpoint) must
// not translate into one giant `atMs` jump when it resumes -- cap the
// per-frame real delta fed into the speed multiplier.
const MAX_FRAME_DELTA_MS = 250;

// SegmentedControl's value type is string-constrained -- each speed's
// own label doubles as its value (labels are unique, per
// `PLAYBACK_SPEED_OPTIONS`), looked back up to a `hoursPerSecond` on change.
const SPEED_OPTIONS: SegmentedControlOption<string>[] = PLAYBACK_SPEED_OPTIONS.map((option) => ({
  value: option.label,
  label: option.label,
}));

function formatLabel(atMs: number): string {
  return new Date(atMs).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface TransportControlProps {
  atMs: number;
  playback: PlaybackState;
  /** Fired every animation frame while playing, and on manual scrub-slider drags. Sets `liveNow` false, same as `ConditionsBar`'s own scrub. */
  onAtMsChange: (atMs: number) => void;
  onPlaybackChange: (next: PlaybackState) => void;
}

export default function TransportControl({
  atMs,
  playback,
  onAtMsChange,
  onPlaybackChange,
}: TransportControlProps) {
  // Anchored once at mount via a lazy `useState` initializer -- same
  // pattern (and reasoning) as ConditionsBar's own TimeScrubber.
  const [anchorNowMs] = useState(() => Date.now());
  const min = anchorNowMs - SCRUB_RANGE_HALF_SPAN_MS;
  const max = anchorNowMs + SCRUB_RANGE_HALF_SPAN_MS;
  const sliderValue = Math.min(max, Math.max(min, atMs));

  // Refs so the rAF callback always reads the LATEST atMs/speed without
  // re-subscribing the loop on every tick (which would fight
  // requestAnimationFrame's own frame-delta bookkeeping). Synced in a
  // layout effect, not during render -- React's rules-of-hooks lint
  // forbids writing a ref's `.current` while rendering.
  const atMsRef = useRef(atMs);
  const speedRef = useRef(playback.speedMultiplier);
  const onAtMsChangeRef = useRef(onAtMsChange);
  useLayoutEffect(() => {
    atMsRef.current = atMs;
    speedRef.current = playback.speedMultiplier;
    onAtMsChangeRef.current = onAtMsChange;
  });

  useEffect(() => {
    if (!playback.playing) return;

    let rafId: number;
    let lastFrameTimeMs: number | null = null;

    function tick(nowMs: number) {
      if (lastFrameTimeMs !== null) {
        const realFrameDeltaMs = Math.min(nowMs - lastFrameTimeMs, MAX_FRAME_DELTA_MS);
        const deltaSimMs = playbackFrameDeltaMs(realFrameDeltaMs, speedRef.current);
        onAtMsChangeRef.current(atMsRef.current + deltaSimMs);
      }
      lastFrameTimeMs = nowMs;
      // rAF pauses automatically when the tab isn't visible (the right
      // default here -- no surprise catch-up jump on return, per this
      // phase's plan file).
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [playback.playing]);

  function togglePlaying() {
    onPlaybackChange({ ...playback, playing: !playback.playing });
  }

  function handleSpeedChange(label: string) {
    const option = PLAYBACK_SPEED_OPTIONS.find((candidate) => candidate.label === label);
    if (option) onPlaybackChange({ ...playback, speedMultiplier: option.hoursPerSecond });
  }

  const currentSpeedLabel =
    PLAYBACK_SPEED_OPTIONS.find((option) => option.hoursPerSecond === playback.speedMultiplier)
      ?.label ?? SPEED_OPTIONS[1].label;

  // A manual scrub-slider drag stops playback rather than fighting it for
  // control of `atMs` (F7.1's own "yields to interaction" AC).
  function handleManualScrub(value: number) {
    if (playback.playing) onPlaybackChange({ ...playback, playing: false });
    onAtMsChange(value);
  }

  return (
    <div className={classes.root} data-testid="transport-control">
      <Button
        variant="outline"
        size="sm"
        aria-label={playback.playing ? 'Pause' : 'Play'}
        onClick={togglePlaying}
      >
        {playback.playing ? (
          <IconPlayerPause size={ICON_SIZE_ACTION} stroke={ICON_STROKE} aria-hidden />
        ) : (
          <IconPlayerPlay size={ICON_SIZE_ACTION} stroke={ICON_STROKE} aria-hidden />
        )}
      </Button>
      <SegmentedControl
        aria-label="Playback speed"
        options={SPEED_OPTIONS}
        value={currentSpeedLabel}
        onChange={handleSpeedChange}
      />
      <span className={classes.label}>{formatLabel(atMs)}</span>
      <Slider
        className={classes.slider}
        thumbLabel="Scrub time"
        value={sliderValue}
        min={min}
        max={max}
        step={60_000}
        label={(value) => formatLabel(value)}
        onChange={handleManualScrub}
      />
    </div>
  );
}
