/**
 * `ViewerState.timeline` (F11.1, phase 14) — Timeline's own reference
 * distance/bearing, used only when `ViewerState.target === null` (Reach
 * mode). ux-and-ia.md §6's documented state model has no field for this
 * ("Timeline's reference distance/bearing when target === null" is F11.1's
 * "or a reference distance" case, not covered elsewhere) — this phase adds
 * it, per its own plan file's explicit instruction, grouped in its own
 * named sub-object on `ViewerState` (a sibling of `display`/`playback`/
 * `compare`, not flat fields), matching `PlaybackState`/`RayControlsState`'s
 * own precedent.
 */
export interface TimelineState {
  referenceDistanceKm: number;
  referenceBearingDeg: number;
}

/**
 * Judgment call, flagged (this phase's own plan file): an arbitrary but
 * reasonable single-hop-to-two-hop F2 DX distance, roughly Anchor A's
 * scale (validation.test.ts's own 3360km worked example), due east.
 */
export const DEFAULT_TIMELINE_STATE: TimelineState = {
  referenceDistanceKm: 3000,
  referenceBearingDeg: 90,
};
