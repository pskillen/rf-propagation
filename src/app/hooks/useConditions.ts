// Owns Conditions.atMs/.liveNow's "now" toggle (F4.6). Not the full
// play/pause/speed/scrub transport control — that's FR-31, phase 10
// (F7.1). This is a simple live-tracking flag: while `liveNow` is true, a
// ~1s interval ticks `atMs` forward to `Date.now()`; any manual scrub or
// explicit time entry calls `scrubTo`, which fixes `atMs` and turns
// `liveNow` off. `goLive` resumes live tracking.
import { useCallback, useEffect, useState } from 'react';

const LIVE_TICK_INTERVAL_MS = 1000;

export interface UseConditionsResult {
  atMs: number;
  liveNow: boolean;
  /** Manual scrub / explicit time entry — fixes atMs, turns liveNow off. */
  scrubTo: (atMs: number) => void;
  /** Resume live tracking from now. */
  goLive: () => void;
}

export function useConditions(initial: { atMs: number; liveNow: boolean }): UseConditionsResult {
  const [atMs, setAtMs] = useState(initial.atMs);
  const [liveNow, setLiveNow] = useState(initial.liveNow);

  useEffect(() => {
    if (!liveNow) return;
    const id = setInterval(() => setAtMs(Date.now()), LIVE_TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [liveNow]);

  const scrubTo = useCallback((nextAtMs: number) => {
    setLiveNow(false);
    setAtMs(nextAtMs);
  }, []);

  const goLive = useCallback(() => {
    setLiveNow(true);
    setAtMs(Date.now());
  }, []);

  return { atMs, liveNow, scrubTo, goLive };
}
