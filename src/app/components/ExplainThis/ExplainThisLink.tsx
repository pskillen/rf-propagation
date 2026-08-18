/**
 * "Explain this" entry point (F8.5, [#67]) — a small button meant to sit
 * next to any verdict or coverage cell on any surface:
 * `<ExplainThisLink target={cellTarget} bandId={cellBandId} />`. Clicking
 * it calls `navigateToExplore` with that cell's own target/band as
 * overrides, landing on Explore with that exact scenario already loaded.
 *
 * THE MECHANISM OTHER SURFACES CALL INTO — Path's verdict table (phase
 * 13, F10.2's "each cell opens into F8.5's explanation") is expected to
 * import this component directly rather than re-implementing
 * navigation-to-Explore. If this component or `navigateToExplore` is
 * renamed/reshaped, later phases relying on this exact export need to be
 * told explicitly (see this phase's PR description).
 *
 * [#67]: https://github.com/pskillen/rf-propagation/issues/67
 */
import { useNavigate } from 'react-router-dom';
import { navigateToExplore, type ExplainThisOverrides } from '../../state/explainThis.ts';
import { useViewerState } from '../../state/viewerState.tsx';
import classes from './ExplainThisLink.module.css';

export interface ExplainThisLinkProps extends ExplainThisOverrides {
  label?: string;
  className?: string;
}

export default function ExplainThisLink({
  target,
  bandId,
  label = 'Explain this',
  className,
}: ExplainThisLinkProps) {
  const navigate = useNavigate();
  const { setState } = useViewerState();

  return (
    <button
      type="button"
      className={[classes.root, className].filter(Boolean).join(' ')}
      onClick={() => navigateToExplore(navigate, setState, { target, bandId })}
    >
      {label}
    </button>
  );
}
