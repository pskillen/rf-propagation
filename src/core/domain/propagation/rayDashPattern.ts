/**
 * Skywave dash density for illustration rays (mk1 tranche-2 H4; F8.2,
 * phase 11's Slice 2) — ported (narrowed) from Codeplug Studio's
 * `src/app/components/HfPropagationGlobe/globePathDash.ts`.
 *
 * DEVIATION FROM THE REFERENCE FILE, FLAGGED: Studio's original keys its
 * dash table on `PropagationMode`'s five values (groundwave/skywave/nvis/
 * absorbed/escaped) and also special-cases `groundwave` (solid, no dash)
 * and a `terminator` path kind. This model's `IllustrationRay.outcome`
 * only ever takes three values (`RayOutcome`, `illustrationRays.ts`) — no
 * groundwave-classified outcome exists anywhere in this engine, and the
 * terminator is phase 9's globe concern, not this module's. Skywave, NVIS
 * and groundwave all collapse into `'returned'`'s dash values below: a ray
 * that returns to ground is a ray that returns to ground regardless of hop
 * geometry, and this model doesn't classify NVIS as a separate ray
 * outcome anywhere. Only the dash-arc table and the fraction-of-arc-length
 * calculation are ported — not the whole reference file.
 */
import type { IllustrationRay, RayOutcome } from './illustrationRays';

const DEG_RAD = Math.PI / 180;

/**
 * Dash/gap arc lengths (radians) per outcome — Studio's own
 * 'skywave'/'absorbed'/'escaped' values, `'skywave'` reused for
 * `'returned'` per this file's own deviation note above.
 */
const OUTCOME_DASH_ARC_RAD: Record<RayOutcome, { dash: number; gap: number }> = {
  returned: { dash: 3.5 * DEG_RAD, gap: 1.8 * DEG_RAD }, // Studio's 'skywave' values
  absorbed: { dash: 1.0 * DEG_RAD, gap: 3.5 * DEG_RAD },
  escaped: { dash: 0.6 * DEG_RAD, gap: 2.2 * DEG_RAD },
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Dash length as a fraction of `totalArcLengthRad`, clamped to [0, 1]. */
export function rayDashLengthFraction(ray: IllustrationRay, totalArcLengthRad: number): number {
  if (!Number.isFinite(totalArcLengthRad) || totalArcLengthRad <= 0) return 0;
  return clamp01(OUTCOME_DASH_ARC_RAD[ray.outcome].dash / totalArcLengthRad);
}

/** Gap length as a fraction of `totalArcLengthRad`, clamped to [0, 1]. */
export function rayGapLengthFraction(ray: IllustrationRay, totalArcLengthRad: number): number {
  if (!Number.isFinite(totalArcLengthRad) || totalArcLengthRad <= 0) return 0;
  return clamp01(OUTCOME_DASH_ARC_RAD[ray.outcome].gap / totalArcLengthRad);
}
