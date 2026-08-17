import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { decodeViewerUrlState } from '../lib/urlState/codec.ts';
import type { SurfaceId } from '../lib/urlState/types.ts';

/**
 * Full runtime viewer state — a superset of `ViewerUrlState` (the
 * URL-serializable subset only; see the plan file's "runtime state vs. URL
 * state" note). `station`, `conditions`, `bandId`, `target`, `display`,
 * `playback`, `compare` are added by phases 6, 7, 8/13, 10/11, 12
 * respectively — each phase adds one property to this interface and one
 * piece of its own provider logic, never edits another phase's fields.
 */
export interface ViewerState {
  surface: SurfaceId;
}

export interface ViewerStateContextValue {
  state: ViewerState;
  setState: (updater: ViewerState | ((prev: ViewerState) => ViewerState)) => void;
}

const ViewerStateContext = createContext<ViewerStateContextValue | null>(null);

function initialViewerState(): ViewerState {
  // Mounted above the router (see App.tsx), so this reads the raw browser
  // API rather than react-router's useSearchParams() — that hook only
  // works inside the router tree. One-time init only: a shared link's
  // `surface` value is respected on first paint. Keeping this in sync with
  // the URL on every subsequent change is a later phase's own concern
  // (none of ViewerState's fields beyond `surface` exist yet for this
  // phase to wire that up).
  const decoded = decodeViewerUrlState(new URLSearchParams(window.location.search));
  return { surface: decoded.surface };
}

export function ViewerStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ViewerState>(initialViewerState);

  const value = useMemo<ViewerStateContextValue>(() => ({ state, setState }), [state]);

  return <ViewerStateContext.Provider value={value}>{children}</ViewerStateContext.Provider>;
}

export function useViewerState(): ViewerStateContextValue {
  const context = useContext(ViewerStateContext);
  if (!context) {
    throw new Error('useViewerState must be used within a ViewerStateProvider');
  }
  return context;
}
