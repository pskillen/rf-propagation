import { useState } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import AppChrome from './components/shell/AppChrome.tsx';
import StationBar from './components/station/StationBar.tsx';
import ConditionsBar from './components/conditions/ConditionsBar.tsx';
import TransportControl from './components/TransportControl/TransportControl.tsx';
import { ViewerStateProvider, useViewerState } from './state/viewerState.tsx';
import { useConditions } from './hooks/useConditions.ts';
import { conditionsUrlStateToInitialTime } from './lib/urlState/fields/conditions.ts';
import { useViewerUrlState } from './hooks/useViewerUrlState.ts';
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
  const { state: urlState } = useViewerUrlState();
  const { state: viewerState, setState: setViewerState } = useViewerState();
  // Seeded once from the URL at first mount, same "own the runtime state,
  // URL is a permalink door in/out" pattern this used to follow inside
  // `ConditionsBar` itself before the phase-10 lift.
  const [initialConditions] = useState(() => urlState.conditions);
  const { atMs, liveNow, scrubTo, goLive } = useConditions(
    conditionsUrlStateToInitialTime(initialConditions),
  );

  return (
    <AppChrome
      stationBar={<StationBar />}
      conditionsBar={
        <ConditionsBar atMs={atMs} liveNow={liveNow} onScrub={scrubTo} onGoLive={goLive} />
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
