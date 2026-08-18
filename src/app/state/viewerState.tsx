import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Station } from '@core/domain/station/types';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import type { Conditions } from '@core/domain/conditions/types';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import { bandMidpointMhz } from '@core/domain/bandCatalog';
import { loadStation } from '@integrations/station/persistence';
import { decodeViewerUrlState } from '../lib/urlState/codec.ts';
import type { SurfaceId } from '../lib/urlState/types.ts';
import { DEFAULT_GLOBE_TOGGLES, type GlobeToggles } from './globeToggles.ts';
import { DEFAULT_PLAYBACK, type PlaybackState } from './playback.ts';

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
 * state" note).
 *
 * CORRECTION (phase 9): this file's doc comment previously said `display`
 * was added by phase 10 ("`display`, `playback`, `compare` are added by
 * phases 10/11, 12 respectively") — a projection written during phase 5,
 * before phase 9's own plan file was drafted. Phase 9's plan file
 * explicitly and repeatedly calls for `ViewerState.display.globeToggles`
 * (Slice 2, F6.2's own "settings persist and are registered with the URL
 * codec" AC), so `display` actually originates HERE, not in phase 10 —
 * phase 10 (transport control) builds its own `playback` field on top of
 * a `display` that already exists by the time it starts. `compare`
 * (phase 12) is unaffected. See this phase's PR description for the full
 * reasoning.
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
 *
 * CORRECTION (phase 10): "since nothing outside ConditionsBar needs to
 * write them (yet)" stopped being true for `atMs`/`liveNow` specifically
 * — the transport control (F7.1) is a second writer, and it lives in the
 * shared chrome, not inside `ConditionsBar`. `atMs`/`liveNow` ownership
 * moves to a single `useConditions()` call made once in `App.tsx`'s
 * `Shell` (above both `ConditionsBar` and `TransportControl`), passed
 * into `ConditionsBar` as props instead of that component calling the
 * hook itself; `driver`/`ground`/`bandId`/`frequencyMhz` are UNCHANGED —
 * still ConditionsBar-local, still published one-way into this context,
 * since nothing outside ConditionsBar writes those.
 */
/** Display-only surface settings — phase 9 (Globe) adds `globeToggles`; later phases may add sibling fields here (never edit `globeToggles`'s own shape from outside this phase). */
export interface DisplayState {
  globeToggles: GlobeToggles;
}

export interface ViewerState {
  surface: SurfaceId;
  station: Station;
  conditions: Conditions;
  bandId: string;
  frequencyMhz: number;
  target: Target | null;
  display: DisplayState;
  /** Transport-control play/pause/speed and the realism-unlock flag (F7.1/F7.3, phase 10). */
  playback: PlaybackState;
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
    // NOT a blind `{ ...DEFAULT_GLOBE_TOGGLES, ...decoded.globe }` spread --
    // globeFieldCodec.decode() always returns every GlobeUrlState key (per
    // the same "override only" contract stationFieldCodec/
    // conditionsFieldCodec use), just `undefined` on any field neither the
    // URL nor DEFAULT_VIEWER_URL_STATE.globe (`{}`) supplied. A spread would
    // still copy those `undefined`-valued keys over DEFAULT_GLOBE_TOGGLES's
    // real values, since object spread does not skip `undefined` properties
    // -- each field needs its own `??` fallback instead.
    display: {
      globeToggles: {
        exaggerationFactor:
          decoded.globe.exaggerationFactor ?? DEFAULT_GLOBE_TOGGLES.exaggerationFactor,
        explodeEnabled: decoded.globe.explodeEnabled ?? DEFAULT_GLOBE_TOGGLES.explodeEnabled,
        fresnelEnabled: decoded.globe.fresnelEnabled ?? DEFAULT_GLOBE_TOGGLES.fresnelEnabled,
        terminatorEnabled:
          decoded.globe.terminatorEnabled ?? DEFAULT_GLOBE_TOGGLES.terminatorEnabled,
        cutawayEnabled: decoded.globe.cutawayEnabled ?? DEFAULT_GLOBE_TOGGLES.cutawayEnabled,
        mapMode: decoded.globe.mapMode ?? DEFAULT_GLOBE_TOGGLES.mapMode,
      },
    },
    // `playing` is never persisted (see this phase's plan file --
    // "nobody wants to reopen the tab into a running animation").
    // `unrealismUnlocked`'s own URL round-trip is Slice 4's own addition
    // (`playbackFieldCodec`) -- this slice just seeds the in-memory default.
    playback: { ...DEFAULT_PLAYBACK },
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
