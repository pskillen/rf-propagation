import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import AppChrome from './components/shell/AppChrome.tsx';
import { ViewerStateProvider } from './state/viewerState.tsx';
import ReachPage from './routes/reach/ReachPage.tsx';
import PathPage from './routes/path/PathPage.tsx';
import TimelinePage from './routes/timeline/TimelinePage.tsx';
import ExplorePage from './routes/explore/ExplorePage.tsx';

function Shell() {
  return (
    <AppChrome>
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
