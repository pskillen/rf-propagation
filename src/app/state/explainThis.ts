/**
 * "Explain this" navigation helper (F8.5, [#67]) — the load-bearing
 * entry point other surfaces call into: switch `surface` to `'explore'`,
 * optionally set `target`/`bandId` first (when the calling cell's own
 * target/band differ from what's currently active), and navigate to the
 * Explore route. No separate "Explore scenario" payload — `ViewerState`
 * is the single shared source of truth (`ux-and-ia.md §6`), so setting
 * these two fields plus `surface` is sufficient for Explore to render the
 * right thing on arrival.
 *
 * DEVIATION FROM THE PLAN FILE'S OWN SKETCH, FLAGGED: the plan's sketch
 * signature takes `setViewerState: (patch: Partial<ViewerState>) => void`
 * — this repo's actual `ViewerStateContextValue.setState` (phase 8) takes
 * `ViewerState | ((prev: ViewerState) => ViewerState)`, not a raw patch
 * setter (there is no "shallow-merge a partial patch" primitive anywhere
 * else in this codebase either — every other `ViewerState` writer,
 * `ReachPage`'s handlers included, uses the updater-function form). This
 * function adapts to the real signature via `setState((prev) => ({
 * ...prev, ...overrides, surface: 'explore' }))` rather than the sketch's
 * two separate calls.
 *
 * [#67]: https://github.com/pskillen/rf-propagation/issues/67
 */
import type { ViewerState } from './viewerState.tsx';

export interface ExplainThisOverrides {
  target?: ViewerState['target'];
  bandId?: string;
}

export function navigateToExplore(
  navigate: (path: string) => void,
  setViewerState: (updater: ViewerState | ((prev: ViewerState) => ViewerState)) => void,
  overrides?: ExplainThisOverrides,
): void {
  setViewerState((prev) => ({ ...prev, ...overrides, surface: 'explore' }));
  navigate('/explore');
}
