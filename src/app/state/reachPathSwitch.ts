/**
 * FR-14's Reach <-> Path switch (F10.4, [#72]) — `target` IS the
 * discriminator between the two answer surfaces, not a side-effect of a
 * separate navigation click (ux-and-ia.md §6's own state-model comment on
 * `target`: "null => Reach, set => Path"). Any surface that needs to know
 * "is this Reach or Path right now" calls this function against the
 * shared `ViewerState` rather than maintaining its own `target !== null`
 * check inline, so the discrimination logic has exactly one definition.
 *
 * [#72]: https://github.com/pskillen/rf-propagation/issues/72
 */
import type { ViewerState } from './viewerState.tsx';

export function activeAnswerSurface(state: Pick<ViewerState, 'target'>): 'reach' | 'path' {
  return state.target !== null ? 'path' : 'reach';
}
