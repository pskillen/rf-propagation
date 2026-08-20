/**
 * Compare's own state-derivation and delta math (F9, phase 12). Compare
 * varies exactly one of antenna, band or time between two otherwise-
 * identical scenarios and calls the engine twice — no new formulas, no
 * new engine code (see this phase's plan file's own "Physics/engine
 * invariant note").
 *
 * `deriveCompareSides` takes a narrow, structurally-typed slice of
 * `ViewerState` (`CompareViewerStateSlice` below) rather than importing
 * `ViewerState` itself from `@app/state/viewerState` — this module lives
 * under `src/core/domain/propagation/`, and `core` never imports from
 * `app` (see AGENTS.md's dependency rule). `ComparePage.tsx` calls this
 * with the real `ViewerState`, which satisfies the slice structurally.
 * This is a deliberate, flagged deviation from the phase file's literal
 * `deriveCompareSides(state: ViewerState)` snippet, not a change to its
 * behaviour.
 */
import type { Mode } from './modes';
import type { ModeVerdict, ReliabilityBucket } from './reliability';

/**
 * `ViewerState.compare` (F9.1) — exactly one of `againstAntennaId`/
 * `againstBandId`/`againstAtMs` is set in the common case (a single
 * "compare by" choice), but `deriveCompareSides` below doesn't enforce
 * that; more than one set simply means both sides differ in more than
 * one respect, a valid if unusual state per the phase file's own note.
 * Deliberately has **no** `againstTargetId`/`againstQth` — both sides
 * always share `station.qth` and `target`.
 */
export interface CompareState {
  enabled: boolean;
  againstAntennaId?: string;
  againstBandId?: string;
  againstAtMs?: number;
}

export const DEFAULT_COMPARE_STATE: CompareState = {
  enabled: false,
  againstAntennaId: undefined,
  againstBandId: undefined,
  againstAtMs: undefined,
};

/** The minimal slice of `ViewerState` `deriveCompareSides` needs — see this file's header. */
export interface CompareViewerStateSlice {
  station: { activeAntennaId: string };
  bandId: string;
  conditions: { atMs: number };
  compare: CompareState;
}

export interface CompareSide {
  antennaId: string;
  bandId: string;
  atMs: number;
}

/**
 * The "current" (left) side is always `state`'s own values; the "against"
 * (right) side substitutes whichever `compare.against*` field is set,
 * falling back to `left`'s own value for anything unset — an unset
 * `compare` produces an identical, zero-delta comparison rather than a
 * partially-undefined one.
 */
export function deriveCompareSides(state: CompareViewerStateSlice): {
  left: CompareSide;
  right: CompareSide;
} {
  const left: CompareSide = {
    antennaId: state.station.activeAntennaId,
    bandId: state.bandId,
    atMs: state.conditions.atMs,
  };
  const right: CompareSide = {
    antennaId: state.compare.againstAntennaId ?? left.antennaId,
    bandId: state.compare.againstBandId ?? left.bandId,
    atMs: state.compare.againstAtMs ?? left.atMs,
  };
  return { left, right };
}

/**
 * F9.2's "the difference is called out in dB, not left for the operator
 * to subtract" — one `CompareDelta` per `Mode` present on both sides,
 * paired by `mode`. `deltaDb` is `right.marginDb - left.marginDb` (a
 * positive delta means the "against" side is the better one).
 */
export interface CompareDelta {
  mode: Mode;
  leftMarginDb: number;
  rightMarginDb: number;
  deltaDb: number;
  leftBucket: ReliabilityBucket;
  rightBucket: ReliabilityBucket;
}

export function computeCompareDeltas(
  leftVerdicts: ModeVerdict[],
  rightVerdicts: ModeVerdict[],
): CompareDelta[] {
  const deltas: CompareDelta[] = [];
  for (const left of leftVerdicts) {
    const right = rightVerdicts.find((candidate) => candidate.mode === left.mode);
    if (!right) continue;
    deltas.push({
      mode: left.mode,
      leftMarginDb: left.marginDb,
      rightMarginDb: right.marginDb,
      deltaDb: right.marginDb - left.marginDb,
      leftBucket: left.bucket,
      rightBucket: right.bucket,
    });
  }
  return deltas;
}
