/**
 * Compare's own no-target delta (F9.2, phase 12's Slice 2) — when
 * `ViewerState.target === null`, there's no single target to compute a
 * `ModeVerdict` against (`compareScenario.ts`'s `computeCompareDeltas` is
 * the target-set path), so the equivalent "called out, not implied"
 * delta is over Reach's own reach-extremes summary metrics instead:
 * groundwave's outer edge and the first hop's inner edge, both already
 * pure numbers from `reachSummary.ts`'s `reachExtremes` (Reach's own
 * already-computed `CoverageGridResult`, no extra engine call).
 *
 * App-layer, not `src/core/domain/propagation/` — it depends on
 * `ReachExtreme` (`@app/components/reach/reachSummary`), and `core` never
 * imports from `app` (see AGENTS.md's dependency rule); this mirrors why
 * `reachSummary.ts` itself lives in `app` despite being pure/no-React.
 * Neither figure here is naturally a dB quantity (both are ranges in km),
 * so per the phase file's own "don't force every comparison into a dB
 * figure when the underlying number genuinely isn't one," this reports
 * plain km deltas rather than inventing a dB framing.
 */
import type { ReachExtreme } from '../reach/reachSummary.ts';

export interface CoverageReachDelta {
  groundwaveMaxKmLeft: number | null;
  groundwaveMaxKmRight: number | null;
  /** right - left, km. `null` when either side has no groundwave coverage at all. */
  groundwaveMaxKmDeltaKm: number | null;
  firstHopMinKmLeft: number | null;
  firstHopMinKmRight: number | null;
  /** right - left, km. `null` when either side has no hop-1+ coverage at all. */
  firstHopMinKmDeltaKm: number | null;
}

function groundwaveMaxKm(extremes: ReachExtreme[]): number | null {
  return extremes.find((extreme) => extreme.hopCount === 0)?.maxRangeKm ?? null;
}

function firstHopMinKm(extremes: ReachExtreme[]): number | null {
  return extremes.find((extreme) => extreme.hopCount >= 1)?.minRangeKm ?? null;
}

export function computeCoverageReachDelta(
  left: ReachExtreme[],
  right: ReachExtreme[],
): CoverageReachDelta {
  const groundwaveMaxKmLeft = groundwaveMaxKm(left);
  const groundwaveMaxKmRight = groundwaveMaxKm(right);
  const firstHopMinKmLeft = firstHopMinKm(left);
  const firstHopMinKmRight = firstHopMinKm(right);

  return {
    groundwaveMaxKmLeft,
    groundwaveMaxKmRight,
    groundwaveMaxKmDeltaKm:
      groundwaveMaxKmLeft !== null && groundwaveMaxKmRight !== null
        ? groundwaveMaxKmRight - groundwaveMaxKmLeft
        : null,
    firstHopMinKmLeft,
    firstHopMinKmRight,
    firstHopMinKmDeltaKm:
      firstHopMinKmLeft !== null && firstHopMinKmRight !== null
        ? firstHopMinKmRight - firstHopMinKmLeft
        : null,
  };
}
