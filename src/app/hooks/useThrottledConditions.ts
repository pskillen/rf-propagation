// Throttles how often a *new* `Conditions` reference is handed to callers
// that trigger expensive work off it (coverage-grid sweeps, per-band
// ranking sweeps, terminator geometry) -- without touching `useConditions`
// itself, which must keep ticking `atMs` every ~1s for anything that just
// *displays* a live clock.
//
// Bug context: `useConditions` ticks `atMs` forward every 1000ms while
// `Conditions.liveNow` is true (the default). Every consumer that derives
// a `useCallback`/`useEffect` dependency directly from the `conditions`
// object -- `useReachCoverage`'s auto-recompute effect, `useBestBandNow`'s
// per-band sweep, `TerminatorLayer`'s per-render geometry -- re-fires on
// every one of those ticks, forever, for as long as a Reach tab stays
// open. `useBestBandNow` alone turns each tick into 9 sequential full
// coverage-grid sweeps (one per `UK_AMATEUR_BANDS` entry). That's the
// mechanical link between "OOM / sluggish" and "refreshing every few
// seconds" reported as the same bug.
//
// `driver` must be compared by VALUE, not by reference: caught only by
// live-browser verification, not by any unit test written against a
// hand-built `Conditions` object (which happens to keep `driver`'s
// reference stable across a spread-copy). `ConditionsBar.tsx`'s
// `useConditionsDriver.ts` reconstructs a brand-new `driver` object
// literal on EVERY render (its own doc comment already flags this: "the
// `driver` object itself, which `useConditionsDriver` reconstructs fresh
// every render"), including the once-a-second render `atMs` ticking
// causes -- so `conditions.driver` never has a stable reference in the
// real app, tick or not. A reference-equality check here would see a
// "changed" driver on every single tick and defeat the whole throttle --
// confirmed live: instrumenting `Worker.postMessage` in a running `npm
// run dev` tab showed ~739 `computeCoverage` messages in 60s with a
// reference-equality check, vs. the expected ~9 (one auto-recompute's
// worth) once this was switched to a value comparison of `driver`'s own
// primitive fields.
import { useState } from 'react';
import type { Conditions, ConditionsDriver } from '@core/domain/conditions/types';

function driversEqual(a: ConditionsDriver, b: ConditionsDriver): boolean {
  return (
    a === b ||
    (a.kind === b.kind &&
      a.sfi === b.sfi &&
      a.kp === b.kp &&
      a.fetchedAtMs === b.fetchedAtMs &&
      a.presetId === b.presetId)
  );
}

/** Matches the human's own "we could drop this to 1 minute" bug report. */
export const DEFAULT_THROTTLE_INTERVAL_MS = 60_000;

/**
 * Returns a `Conditions` value that only adopts a new `atMs` once it has
 * moved by at least `intervalMs` since the last value this hook returned.
 * Any other field changing (`liveNow`, `driver`, `ground`) -- i.e. anything
 * that isn't just the live clock ticking -- passes through immediately, on
 * the very next render, so explicit user actions (editing SFI/Kp/ground in
 * the chrome bars, scrubbing to a specific time, pressing "go live") still
 * recompute promptly. The FIRST value passed in also passes through
 * immediately (nothing to throttle against yet).
 *
 * This does not debounce or delay -- it's a pure "is this new enough to
 * count" filter evaluated synchronously during render, so it never adds an
 * extra committed render pass or a timer of its own (it uses React's own
 * "storing information from previous renders" pattern -- a conditional
 * `setState` call during render -- rather than a ref, since refs may not
 * be read during render). Callers that need instant, unthrottled reaction
 * to the raw `conditions` (e.g. live marker-drag) should keep using the
 * original `conditions` object directly, not this hook's result.
 */
export function useThrottledConditions(
  conditions: Conditions,
  intervalMs: number = DEFAULT_THROTTLE_INTERVAL_MS,
): Conditions {
  const [accepted, setAccepted] = useState<{ value: Conditions; atMs: number }>(() => ({
    value: conditions,
    atMs: conditions.atMs,
  }));

  const nonTimeFieldChanged =
    accepted.value.liveNow !== conditions.liveNow ||
    !driversEqual(accepted.value.driver, conditions.driver) ||
    accepted.value.ground !== conditions.ground;
  const timeMovedEnough = Math.abs(conditions.atMs - accepted.atMs) >= intervalMs;

  if (accepted.value !== conditions && (nonTimeFieldChanged || timeMovedEnough)) {
    setAccepted({ value: conditions, atMs: conditions.atMs });
    return conditions;
  }

  return accepted.value;
}
