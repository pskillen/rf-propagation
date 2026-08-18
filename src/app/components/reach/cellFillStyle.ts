/**
 * Coverage-cell shading (F5.3, Slice 3) — pure so the "skip zone gets zero
 * fill" and "hue by hopCount / opacity by reliability" rules are directly
 * testable without a canvas. Consumed by `CoverageCanvasLayer` (Slice 2).
 *
 * The scheme itself is NOT specified numerically anywhere in the design
 * doc set — this phase invents one, flagged exactly like phase 4 flagged
 * its own groundwave-range/reference-mode judgment calls. Phase 9 (Globe)
 * must reproduce this exact formula for F6.3's "reads consistently with
 * the 2D map" — see this phase's PR description / Cross-phase note if it
 * ever changes.
 */

/** `CoverageGridResult.hopCount`'s no-coverage sentinel (the skip zone). */
const NO_COVERAGE = 255;

/**
 * Hue per `hopCount` category — groundwave (0) through hop 4, cool to warm
 * as hop count (and so typically distance/uncertainty) rises. Exported so
 * `CoverageLegend` (Slice 3) can render swatches from the same source of
 * truth rather than a second copy of these hex values.
 */
export const HOP_BAND_COLORS: Record<number, string> = {
  0: '#4d7cff', // groundwave — matches mk1's MODE_COLORS.groundwave for visual continuity
  1: '#3ddc97', // hop 1
  2: '#f5a623', // hop 2
  3: '#e8590c', // hop 3
  4: '#c92a2a', // hop 4
};

const MIN_OPACITY = 0.15;
const OPACITY_RANGE = 0.65;

export interface CellFillStyle {
  /** Hex fill colour for this cell's hop-count category. */
  color: string;
  /** 0..1 — scales with reliability so "poor but real" stays visible and distinct from "no coverage." */
  opacity: number;
}

/**
 * `hopCount === 255` (the skip zone / no coverage) returns `null` — "zero
 * fill," not a colour with opacity 0, so a caller can distinguish "don't
 * draw this cell" from "draw it, but very faintly" (which a near-zero
 * `reliability` still legitimately wants, per FR-9's "no bare booleans").
 * Any `hopCount` outside the known 0-4 band-hue table (shouldn't happen —
 * `COVERAGE_MAX_HOPS` caps the engine at 4 — but not asserted here)
 * clamps to hop 4's colour rather than rendering `undefined`.
 */
export function cellFillStyle(hopCount: number, reliability: number): CellFillStyle | null {
  if (hopCount === NO_COVERAGE) return null;

  const color = HOP_BAND_COLORS[hopCount] ?? HOP_BAND_COLORS[4];
  const clampedReliability = Math.max(0, Math.min(1, reliability));
  const opacity = MIN_OPACITY + OPACITY_RANGE * clampedReliability;

  return { color, opacity };
}

/** Convenience re-export of the grid's own sentinel, for callers that need to check it directly (e.g. Slice 4's reach-extremes walk). */
export const COVERAGE_NO_DATA = NO_COVERAGE;
