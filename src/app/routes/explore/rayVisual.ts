/**
 * Pure ray -> colour mapping for Explore's ray overlay (F8.2, phase 11's
 * Slice 2 — outcome colouring only; Slice 3 extends this with layer/
 * signal-strength colouring, filtering and layer soloing). App-layer
 * presentation logic, not physics — it only reads `IllustrationRay.outcome`
 * (already computed by phase 4's engine) and maps it to a colour.
 */
import type { IllustrationRay, RayOutcome } from '@core/domain/propagation/illustrationRays';

const OUTCOME_COLORS: Record<RayOutcome, string> = {
  returned: '#5ec8ff',
  absorbed: '#f5c451',
  escaped: '#8a93a6',
};

export function colorForRayOutcome(outcome: RayOutcome): string {
  return OUTCOME_COLORS[outcome];
}

export interface RenderedExploreRay {
  ray: IllustrationRay;
  color: string;
}

/** Slice 2's default colouring: by outcome, every ray shown. */
export function rayOutcomeColouring(rays: IllustrationRay[]): RenderedExploreRay[] {
  return rays.map((ray) => ({ ray, color: colorForRayOutcome(ray.outcome) }));
}
