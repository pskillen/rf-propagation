/**
 * `ViewerState.display.rayControls` (F8.2/F8.3, phase 11's Slices 2-3) —
 * Explore's illustration-ray operator controls: how many rays to draw
 * (`radials` x `elevations`, both operator-sized per phase 4's own
 * `generateIllustrationRays` ceiling of 16 x 10), where to point them
 * (`elevationSpreadDeg`, `focusBearingDeg` when there is no `target` to
 * derive a bearing from), and how to filter/colour/solo the resulting
 * `IllustrationRay[]` for display (`outcomeFilter`, `colourBy`,
 * `soloLayerId`) — never re-running the engine, per this phase's own
 * "illustration is not compute" invariant.
 *
 * Naming judgment call, flagged: grouped under its own `rayControls` key on
 * `DisplayState` (a sibling of `globeToggles`, phase 9) rather than as flat
 * fields directly on `DisplayState` — this phase's own plan file sketched
 * `display: { ..., outcomeFilter, colourBy, soloLayerId, ... }` flat, but
 * `globeToggles` already set the "each surface's settings live in their own
 * named sub-object" precedent, so this follows that rather than the plan
 * file's flat sketch (the plan file's own state model section is itself a
 * projection from phases 5-10, not phase 5's actual shipped shape).
 */
import type { LayerId } from '@core/domain/propagation/layers';
import type { RayOutcome } from '@core/domain/propagation/illustrationRays';

export type RayColourBy = 'mode' | 'layer' | 'signalStrength';

export interface RayControlsState {
  /** 1-16 (generateIllustrationRays' own ceiling). */
  radials: number;
  /** 1-10 per radial. */
  elevations: number;
  elevationSpreadDeg: [number, number];
  /** Manual fan bearing (degrees true) used only when `ViewerState.target` is null. */
  focusBearingDeg: number;
  outcomeFilter: 'all' | RayOutcome;
  colourBy: RayColourBy;
  soloLayerId?: LayerId;
}

export const RAY_RADIALS_MIN = 1;
export const RAY_RADIALS_MAX = 16;
export const RAY_ELEVATIONS_MIN = 1;
export const RAY_ELEVATIONS_MAX = 10;

/**
 * A modest default ray count (well under the 16x10 ceiling) spread across
 * a typical low-to-mid takeoff-angle band, all outcomes shown, coloured by
 * outcome (`'mode'`) — a readable-on-first-load default, not a spec value.
 */
export const DEFAULT_RAY_CONTROLS: RayControlsState = {
  radials: 8,
  elevations: 3,
  elevationSpreadDeg: [5, 70],
  focusBearingDeg: 0,
  outcomeFilter: 'all',
  colourBy: 'mode',
  soloLayerId: undefined,
};
