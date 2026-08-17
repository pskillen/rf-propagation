import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decodeViewerUrlState, encodeViewerUrlState } from '../lib/urlState/codec.ts';
import type { ViewerUrlState } from '../lib/urlState/types.ts';

/**
 * Reads/writes `ViewerUrlState` to and from the current route's address-bar
 * query string, via react-router's `useSearchParams()`. Must be called from
 * inside the router tree (a descendant of `RouterProvider`) — it cannot be
 * used above the router, unlike `viewerState.ts`'s one-time init from raw
 * `location.search`.
 *
 * This phase's only field (`surface`) changes on navigation clicks, not
 * drags, so no debouncing is needed yet. Flag for phase 7: its Conditions
 * time-scrub field changes continuously and must debounce the URL *write*
 * (not the render) — see the `debounced-inputs` skill.
 */
export function useViewerUrlState(): {
  state: ViewerUrlState;
  setState: (next: ViewerUrlState) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  const state = useMemo(() => decodeViewerUrlState(searchParams), [searchParams]);

  const setState = useCallback(
    (next: ViewerUrlState) => {
      setSearchParams(encodeViewerUrlState(next), { replace: true });
    },
    [setSearchParams],
  );

  return { state, setState };
}
