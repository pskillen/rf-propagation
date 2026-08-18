import { useCallback, useState } from 'react';
import { createBrowserRouter, Outlet, RouterProvider, useNavigate } from 'react-router-dom';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import { bandMidpointMhz } from '@core/domain/bandCatalog';
import { saveStation } from '@integrations/station/persistence';
import AppChrome from './components/shell/AppChrome.tsx';
import ResetButton from './components/shell/ResetButton.tsx';
import ShareButton from './components/shell/ShareButton.tsx';
import PresetMenu from './components/shell/PresetMenu.tsx';
import StationBar from './components/station/StationBar.tsx';
import ConditionsBar from './components/conditions/ConditionsBar.tsx';
import TransportControl from './components/TransportControl/TransportControl.tsx';
import { ViewerStateProvider, useViewerState } from './state/viewerState.tsx';
import { DEFAULT_GLOBE_TOGGLES } from './state/globeToggles.ts';
import { DEFAULT_PLAYBACK } from './state/playback.ts';
import { DEFAULT_RAY_CONTROLS } from './state/rayControls.ts';
import { useConditions } from './hooks/useConditions.ts';
import { conditionsUrlStateToInitialTime } from './lib/urlState/fields/conditions.ts';
import { useViewerUrlState } from './hooks/useViewerUrlState.ts';
import { DEFAULT_BAND_ID, DEFAULT_VIEWER_URL_STATE } from './lib/urlState/types.ts';
import ReachPage from './routes/reach/ReachPage.tsx';
import PathPage from './routes/path/PathPage.tsx';
import TimelinePage from './routes/timeline/TimelinePage.tsx';
import ExplorePage from './routes/explore/ExplorePage.tsx';

function Shell() {
  // The Conditions clock (F7.1, phase 10) -- instantiated ONCE here,
  // above both `ConditionsBar` and `TransportControl`, so the two share
  // one `atMs`/`liveNow` rather than each owning a divergent copy. See
  // `viewerState.tsx`'s phase-10 CORRECTION note: this used to be
  // `ConditionsBar`'s own internal `useConditions()` call; it moved up
  // once the transport control became a second writer of `atMs`.
  const { state: urlState, setState: setUrlState } = useViewerUrlState();
  const { state: viewerState, setState: setViewerState } = useViewerState();
  const navigate = useNavigate();
  // Seeded once from the URL at first mount, same "own the runtime state,
  // URL is a permalink door in/out" pattern this used to follow inside
  // `ConditionsBar` itself before the phase-10 lift.
  const [initialConditions] = useState(() => urlState.conditions);
  const { atMs, liveNow, scrubTo, goLive } = useConditions(
    conditionsUrlStateToInitialTime(initialConditions),
  );

  // Global reset-to-defaults (F7.2, phase 10's Slice 2). `resetNonce`
  // bumps `ConditionsBar`'s own `resetToken` prop (see that component's
  // doc comment for why local-state reset, not a `key`-based remount) and
  // remounts `StationBar` (a plain `key`, safe there -- `StationBar` has
  // no async URL dependency, it only resets its own `editing`/draft-form
  // UI state). The shared clock itself is reset directly via `goLive()`.
  const [resetNonce, setResetNonce] = useState(0);

  const handleReset = useCallback(() => {
    saveStation(DEFAULT_STATION);
    // Clears the URL back to its own defaults FIRST, so the remounted
    // ConditionsBar (below) seeds its local state (driver/ground/band)
    // from a clean slate rather than the pre-reset query string --
    // otherwise a reload right after Reset would resurrect it (F7.2's own
    // "a reload after reset doesn't resurrect the pre-reset state" AC).
    setUrlState({ ...DEFAULT_VIEWER_URL_STATE });
    setViewerState({
      surface: 'reach',
      station: DEFAULT_STATION,
      conditions: DEFAULT_CONDITIONS,
      bandId: DEFAULT_BAND_ID,
      frequencyMhz: bandMidpointMhz(DEFAULT_BAND_ID),
      target: null,
      display: {
        globeToggles: { ...DEFAULT_GLOBE_TOGGLES },
        rayControls: { ...DEFAULT_RAY_CONTROLS },
      },
      playback: { ...DEFAULT_PLAYBACK },
    });
    goLive();
    setResetNonce((n) => n + 1);
    navigate('/');
  }, [goLive, navigate, setUrlState, setViewerState]);

  return (
    <AppChrome
      resetButton={<ResetButton onReset={handleReset} />}
      shareButton={<ShareButton />}
      presetMenu={<PresetMenu />}
      stationBar={<StationBar key={resetNonce} />}
      conditionsBar={
        <ConditionsBar
          atMs={atMs}
          liveNow={liveNow}
          onScrub={scrubTo}
          onGoLive={goLive}
          resetToken={resetNonce}
        />
      }
      transportControl={
        <TransportControl
          atMs={atMs}
          playback={viewerState.playback}
          onAtMsChange={scrubTo}
          onPlaybackChange={(next) => setViewerState((prev) => ({ ...prev, playback: next }))}
        />
      }
    >
      <Outlet />
    </AppChrome>
  );
}

const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <ReachPage /> },
      { path: '/path', element: <PathPage /> },
      { path: '/timeline', element: <TimelinePage /> },
      { path: '/explore', element: <ExplorePage /> },
    ],
  },
]);

export default function App() {
  return (
    <ViewerStateProvider>
      <RouterProvider router={router} />
    </ViewerStateProvider>
  );
}
