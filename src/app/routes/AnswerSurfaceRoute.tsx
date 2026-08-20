/**
 * FR-14's Reach <-> Path answer-surface switch (F10.4, [#72]) — the `/`
 * route renders whichever surface `activeAnswerSurface` says is active,
 * rather than a literal `surface === 'reach' | 'path'` check the operator
 * sets directly. Selecting a target (from Reach's own cell-click, or
 * Path's own target picker while arrived at via the `/path` nav item)
 * flips this from Reach to Path in place; clearing it flips back —
 * "there is no separate 'switch to Reach' button that leaves target
 * set" (F10.4's own acceptance criterion).
 *
 * `/path` (this app's own nav item, phase 5) still routes directly to
 * `PathPage` regardless of this switch — `PathPage` itself renders the
 * target picker's empty state when `target` is `null`, which is how an
 * operator sets a target from Path in the first place (this switch alone
 * has no way to reach Path without one already set). Both routes end up
 * mounting the exact same `PathPage`, so there is no risk of the two
 * diverging.
 *
 * [#72]: https://github.com/pskillen/rf-propagation/issues/72
 */
import { activeAnswerSurface } from '../state/reachPathSwitch.ts';
import { useViewerState } from '../state/viewerState.tsx';
import ReachPage from './reach/ReachPage.tsx';
import PathPage from './path/PathPage.tsx';
import classes from './AnswerSurfaceRoute.module.css';

export default function AnswerSurfaceRoute() {
  const { state } = useViewerState();
  const surface = activeAnswerSurface(state);

  return (
    <div className={classes.root} key={surface}>
      {surface === 'path' ? <PathPage /> : <ReachPage />}
    </div>
  );
}
