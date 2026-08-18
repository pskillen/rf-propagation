/**
 * Pure ray -> colour/visibility mapping for Explore's ray overlay (F8.2's
 * outcome colouring, F8.3's filter/colour-by/layer-solo — phase 11's
 * Slices 2-3). App-layer presentation logic, not physics: it reads
 * already-computed `IllustrationRay` fields (plus, for `'signalStrength'`,
 * a per-ray link budget from `computeIllustrationRayBudget`) and maps them
 * to a colour and a dim/hide flag. Never calls `computeCoverageGrid` or
 * `generateIllustrationRays` — see `applyRayVisuals`'s own doc comment for
 * the explicit invariant this file exists to respect.
 */
import type { CoverageGridInput } from '@core/domain/propagation/coverageGrid';
import type { IllustrationRay, RayOutcome } from '@core/domain/propagation/illustrationRays';
import type { LayerId } from '@core/domain/propagation/layers';
import { colorForLayer } from '@core/domain/propagation/layerColor';
import { computeIllustrationRayBudget } from '@core/domain/propagation/rayLinkBudget';
import type { RayColourBy, RayControlsState } from '../../state/rayControls.ts';

const OUTCOME_COLORS: Record<RayOutcome, string> = {
  returned: '#5ec8ff',
  absorbed: '#f5c451',
  escaped: '#8a93a6',
};

export function colorForRayOutcome(outcome: RayOutcome): string {
  return OUTCOME_COLORS[outcome];
}

/** Neutral grey for an escaped ray under `colourBy: 'layer'` — it never reflects, so `reflectingLayers` is empty. */
const NO_LAYER_COLOR = '#8a93a6';

function colorForRayLayer(ray: IllustrationRay): string {
  const lastLayer = ray.reflectingLayers.at(-1);
  return lastLayer ? colorForLayer(lastLayer) : NO_LAYER_COLOR;
}

/** SNR (dB) mapped to a red (weak) -> green (strong) gradient, clamped to a readable range. */
const SIGNAL_SNR_MIN_DB = 0;
const SIGNAL_SNR_MAX_DB = 30;
const SIGNAL_WEAK_COLOR = '#ff5c7a';
const SIGNAL_STRONG_COLOR = '#3ddc97';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixHexColors(fromHex: string, toHex: string, t: number): string {
  const from = Number.parseInt(fromHex.slice(1), 16);
  const to = Number.parseInt(toHex.slice(1), 16);
  const r = Math.round(lerp((from >> 16) & 0xff, (to >> 16) & 0xff, t));
  const g = Math.round(lerp((from >> 8) & 0xff, (to >> 8) & 0xff, t));
  const b = Math.round(lerp(from & 0xff, to & 0xff, t));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Grey for a ray with no complete budget (escaped, or absorbed before any hop landed). */
const NO_SIGNAL_COLOR = '#5a6272';

function colorForRaySignalStrength(ray: IllustrationRay, context: CoverageGridInput): string {
  const budget = computeIllustrationRayBudget(ray, context);
  if (!budget) return NO_SIGNAL_COLOR;
  const t = Math.max(
    0,
    Math.min(1, (budget.snrDb2400 - SIGNAL_SNR_MIN_DB) / (SIGNAL_SNR_MAX_DB - SIGNAL_SNR_MIN_DB)),
  );
  return mixHexColors(SIGNAL_WEAK_COLOR, SIGNAL_STRONG_COLOR, t);
}

function colorForRay(
  ray: IllustrationRay,
  colourBy: RayColourBy,
  context: CoverageGridInput,
): string {
  if (colourBy === 'layer') return colorForRayLayer(ray);
  if (colourBy === 'signalStrength') return colorForRaySignalStrength(ray, context);
  return colorForRayOutcome(ray.outcome);
}

export interface RenderedExploreRay {
  ray: IllustrationRay;
  color: string;
  /** Dimmed by layer-solo (still present so the caller can render it faded, not remove it outright). */
  dimmed: boolean;
}

/**
 * THE INVARIANT THIS FILE EXISTS TO RESPECT (F8.3's own acceptance
 * criterion, restated): applying `outcomeFilter`/`colourBy`/`soloLayerId`
 * in any combination is a pure transform over the `rays` array Slice 2's
 * single `generateIllustrationRays` call already produced. This function
 * never calls `generateIllustrationRays` or `computeCoverageGrid` —
 * `colourBy: 'signalStrength'` calls `computeIllustrationRayBudget`
 * (bounded by the <=160-ray ceiling), which is expected, pure-engine-
 * function-reuse-for-display and NOT a second grid sweep — see
 * `rayVisual.test.ts`'s own invariant test for the enforced check.
 */
export function applyRayVisuals(
  rays: IllustrationRay[],
  rayControls: RayControlsState,
  context: CoverageGridInput,
): RenderedExploreRay[] {
  const { outcomeFilter, colourBy, soloLayerId } = rayControls;
  return rays
    .filter((ray) => outcomeFilter === 'all' || ray.outcome === outcomeFilter)
    .map((ray) => ({
      ray,
      color: colorForRay(ray, colourBy, context),
      dimmed: soloLayerId != null && !ray.reflectingLayers.includes(soloLayerId as LayerId),
    }));
}
