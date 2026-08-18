/**
 * Owns the coverage-grid Worker client for Reach (Slice 2, F5.2) — one
 * `CoverageGridClient` per mount, recomputing whenever Station/Conditions/
 * frequency change AND whenever `recompute(qth)` is called directly with
 * an explicit override (the live-drag path, Slice 1/2).
 *
 * "Fire a new request on every drag-move event, let the client's own
 * supersede logic handle the rest" (phase 4's own instruction) — this hook
 * does NOT debounce `recompute`; `CoverageGridClient.compute()`'s own
 * cancel-on-supersede contract is what keeps "rapid successive requests
 * leave exactly one fine result standing" true here, exactly as it does in
 * `coverageGridClient.test.ts`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Station } from '@core/domain/station/types';
import type { Conditions } from '@core/domain/conditions/types';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import { CoverageGridClient } from '@integrations/propagation/coverageGridClient';
import { useThrottledConditions } from '../../hooks/useThrottledConditions.ts';
import { buildCoverageGridInput } from './buildCoverageGridInput.ts';

export type CoveragePass = 'coarse' | 'fine';

export interface UseReachCoverageResult {
  result: CoverageGridResult | null;
  pass: CoveragePass | null;
  /** Recomputes at an explicit qth override (e.g. the marker's live drag position) — falls back to `station.qth` if omitted. */
  recompute: (qthOverride?: { lat: number; lon: number }) => void;
}

export function useReachCoverage(
  station: Station,
  conditions: Conditions,
  frequencyMhz: number,
  /** Test seam — production code never passes this, letting `CoverageGridClient` construct its real Worker. */
  clientFactory: () => CoverageGridClient = () => new CoverageGridClient(),
): UseReachCoverageResult {
  const clientRef = useRef<CoverageGridClient | null>(null);

  // Created and destroyed inside the SAME effect (not created eagerly
  // during render, only destroyed in cleanup) -- this matters under
  // React 19 StrictMode's dev-only double-invoke of effects (mount ->
  // cleanup -> mount again, with no re-render in between). A client
  // created during render and only torn down in an effect cleanup gets
  // destroyed by the phantom cleanup and never recreated, since nothing
  // re-runs the render-time creation check -- the component is left
  // holding a dead Worker forever (recompute() posts to a terminated
  // Worker, which silently drops the message; the returned promise never
  // resolves or rejects, and the surface hangs on "Computing coverage…"
  // indefinitely). Caught via live browser verification, not the test
  // suite -- @testing-library/react's renderHook doesn't wrap in
  // StrictMode, so the double-invoke bug didn't reproduce there. Creating
  // the client INSIDE the effect means StrictMode's phantom cycle ends
  // with a fresh, live client (create A -> destroy A -> create B), not a
  // permanently-dead one.
  useEffect(() => {
    const client = clientFactory();
    clientRef.current = client;
    return () => {
      client.destroy();
      clientRef.current = null;
    };
    // clientFactory is a test seam only; production callers never pass a
    // changing one, and re-running this effect on every identity change
    // would tear down and rebuild the Worker needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, setState] = useState<{
    result: CoverageGridResult | null;
    pass: CoveragePass | null;
  }>({ result: null, pass: null });

  const recompute = useCallback(
    (qthOverride?: { lat: number; lon: number }) => {
      // Guards the (unlikely in practice) race where recompute() fires
      // before the creation effect above has run -- rather than a
      // null-assertion crash, this call is simply skipped; the auto-
      // recompute effect below runs after client creation and will
      // still produce a result.
      if (clientRef.current == null) return;
      const input = buildCoverageGridInput(
        station,
        conditions,
        frequencyMhz,
        qthOverride ?? station.qth,
      );
      clientRef.current
        .compute(input, (coarse) => setState({ result: coarse, pass: 'coarse' }))
        .then((fine) => setState({ result: fine, pass: 'fine' }))
        .catch(() => {
          // Superseded/cancelled by a newer recompute() call, or the client
          // was destroyed on unmount -- the newer call's own resolution (or
          // the unmount itself) already covers this; nothing to surface.
        });
    },
    [station, conditions, frequencyMhz],
  );

  // Recompute whenever Station/Conditions/frequency change for reasons
  // OTHER than a live drag (e.g. editing power/antenna/SFI in the chrome
  // bars) -- Reach's shading must reflect those too, not just marker drags.
  //
  // Gated on `throttledConditions`, NOT `conditions`/`recompute` directly:
  // while `Conditions.liveNow` is true, `useConditions` ticks `atMs`
  // forward every ~1s, forever. `recompute`'s identity changes on every one
  // of those ticks (it depends on `conditions`), so depending on `recompute`
  // here re-fires a full coarse+fine coverage-grid sweep roughly once a
  // second for as long as Reach stays open -- the reported OOM/sluggishness
  // bug (the human's own fix suggestion: "we could drop this to 1 minute
  // and the user would still not see any issues"). `throttledConditions`
  // only changes identity on a MEANINGFUL Conditions change -- a non-atMs
  // field (driver/ground/liveNow -- SFI/Kp/ground edits, scrubbing to an
  // explicit time, "go live") passes through immediately; a live-clock-only
  // atMs change is held back until it has moved >= 60s. See
  // useThrottledConditions.ts.
  //
  // `recompute` is deliberately NOT in this effect's deps: React still
  // calls this effect with the CURRENT render's `recompute` closure (fresh
  // station/conditions/frequencyMhz) whenever it actually runs -- omitting
  // it from the dep array only stops React from re-running the effect on
  // renders where `recompute`'s identity changed for a reason
  // (`throttledConditions` unchanged) that isn't itself a dep change.
  //
  // The live-drag path (`ReachPage.tsx`'s `handleStationDrag`) calls
  // `recompute(qthOverride)` directly, bypassing this effect entirely, and
  // stays fully unthrottled -- this only changes how often the AUTOMATIC
  // recompute fires, never the manual one.
  const throttledConditions = useThrottledConditions(conditions);
  useEffect(() => {
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station, throttledConditions, frequencyMhz]);

  return { result: state.result, pass: state.pass, recompute };
}
