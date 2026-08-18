import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Station } from '@core/domain/station/types';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import type { Conditions } from '@core/domain/conditions/types';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import { bandMidpointMhz } from '@core/domain/bandCatalog';
import { loadStation } from '@integrations/station/persistence';
import { decodeViewerUrlState } from '../lib/urlState/codec.ts';
import type { SurfaceId } from '../lib/urlState/types.ts';

/**
 * `ViewerState.target`'s source — how the operator set the current target.
 * Only `'map-click'` exists yet (Reach's Slice 5, phase 8); Path's own
 * target picker (phase 13, F5.5's own cross-phase note) adds
 * locator/coordinates/place-name entry as additional source values on top
 * of this, not a replacement for it.
 */
export type TargetSource = 'map-click';

/** A recorded target — `ViewerState.target === null` means Reach (no target); non-null means Path (FR-14). */
export interface Target {
  lat: number;
  lon: number;
  label?: string;
  source: TargetSource;
}

/**
 * Full runtime viewer state — a superset of `ViewerUrlState` (the
 * URL-serializable subset only; see the plan file's "runtime state vs. URL
 * state" note). `display`, `playback`, `compare` are added by phases
 * 10/11, 12 respectively — each phase adds one property to this interface
 * and one piece of its own provider logic, never edits another phase's
 * fields.
 *
 * `station`/`conditions`/`bandId`/`frequencyMhz`/`target` (phase 8, Reach)
 * are a DEVIATION from phases 6/7's actual shipped shape: those phases
 * (per their own PRs) kept Station and Conditions as component-local state
 * inside `StationBar`/`ConditionsBar` rather than lifting them into this
 * context, even though this file's own doc comment (written during phase
 * 5) already anticipated "`station`, `conditions`... added by phases 6, 7."
 * Reach is the first surface that actually NEEDS to read both (to build a
 * `CoverageGridInput`) from outside the chrome bars that own them, so this
 * phase closes that gap: `station` becomes the single source of truth
 * (StationBar reads/writes it here instead of its own `useState`, so a
 * Reach-driven marker-drag-commit and a StationBar edit both stay in
 * sync); `conditions`/`bandId`/`frequencyMhz` stay owned by ConditionsBar's
 * existing hooks (`useConditions`/`useConditionsDriver`) but are published
 * into this context one-way on every change, since nothing outside
 * ConditionsBar needs to write them (yet). See this PR's description for
 * the full reasoning — flagged there as a decision later phases (9-15,
 * which all read Station/Conditions the same way) should be aware of.
 */
export interface ViewerState {
  surface: SurfaceId;
  station: Station;
  conditions: Conditions;
  bandId: string;
  frequencyMhz: number;
  target: Target | null;
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
  // `surface`/`bandId` values are respected on first paint (same source
  // `decodeViewerUrlState` already gives `ConditionsBar`/`StationBar`'s own
  // initial-render logic, so this doesn't drift from theirs). Keeping this
  // in sync with the URL on every subsequent change is a later phase's own
  // concern (phase 10's permalink).
  //
  // `conditions` deliberately does NOT replay the URL's `t`/`dk`/`sfi`/`kp`
  // overrides here (unlike `bandId`) — that logic already lives in
  // `ConditionsBar`/`useConditionsDriver`, and duplicating it here risks
  // the two copies drifting. This context's `conditions` starts at
  // `DEFAULT_CONDITIONS` and is corrected to the real (possibly
  // URL-overridden) value by `ConditionsBar`'s own publish-effect within
  // its first render pass — a one-frame default-conditions flash on a
  // shared-link load, accepted as a documented tradeoff rather than a
  // second URL-parsing implementation to keep in sync.
  const decoded = decodeViewerUrlState(new URLSearchParams(window.location.search));
  return {
    surface: decoded.surface,
    station: loadStation() ?? DEFAULT_STATION,
    conditions: DEFAULT_CONDITIONS,
    bandId: decoded.bandId,
    frequencyMhz: bandMidpointMhz(decoded.bandId),
    // A shared link's target (Slice 5, F5.5) round-trips through the URL
    // codec even though this phase's own UI never writes `source` values
    // other than 'map-click' -- see TargetUrlState's own doc comment for
    // why `label`/`source` are lossy across a permalink.
    target: decoded.target ? { ...decoded.target, source: 'map-click' } : null,
  };
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
