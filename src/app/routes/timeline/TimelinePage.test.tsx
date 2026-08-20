import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import { ViewerStateProvider, useViewerState } from '../../state/viewerState.tsx';
import type { ShellOutletContext } from '../shellOutletContext.ts';
import TimelinePage from './TimelinePage.tsx';

const FIXED_AT_MS = Date.UTC(2026, 5, 21, 9, 0, 0);

function ShellStub({ scrubTo = () => {} }: { scrubTo?: (atMs: number) => void }) {
  const context: ShellOutletContext = { atMs: FIXED_AT_MS, liveNow: false, scrubTo };
  return <Outlet context={context} />;
}

function TargetProbe({ lat, lon }: { lat: number; lon: number }) {
  const { setState } = useViewerState();
  return (
    <button
      type="button"
      onClick={() => setState((prev) => ({ ...prev, target: { lat, lon, source: 'coordinates' } }))}
    >
      set target
    </button>
  );
}

beforeEach(() => {
  localStorage.clear();
});

function renderTimelinePage(scrubTo?: (atMs: number) => void) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: <ShellStub scrubTo={scrubTo} />,
      children: [{ index: true, element: <TimelinePage /> }],
    },
  ]);
  return render(
    <ViewerStateProvider>
      <DesignSystemV2Provider>
        <TargetProbe lat={40} lon={-74} />
        <RouterProvider router={router} />
      </DesignSystemV2Provider>
    </ViewerStateProvider>,
  );
}

describe('TimelinePage', () => {
  it('renders the 24-hour x band grid and shows the reference-distance control when no target is set', () => {
    renderTimelinePage();
    expect(screen.getByLabelText('24-hour band-by-band reliability grid')).toBeInTheDocument();
    expect(screen.getByLabelText('Reference distance (km)')).toBeInTheDocument();
  });

  it('hides the reference-distance control once a target is set', async () => {
    renderTimelinePage();
    fireEvent.click(screen.getByText('set target'));
    expect(
      await screen.findByLabelText('24-hour band-by-band reliability grid'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Reference distance (km)')).not.toBeInTheDocument();
  });

  it('clicking a cell sets the Conditions time to that hour on the same UTC day, leaving the date unchanged (F11.2)', async () => {
    const scrubTo = vi.fn();
    renderTimelinePage(scrubTo);

    // FIXED_AT_MS is 2026-06-21T09:00:00Z -- click the 15z column of the
    // first band row.
    fireEvent.click(await screen.findByLabelText(/160 m at 15z/));

    expect(scrubTo).toHaveBeenCalledTimes(1);
    const committedAtMs = scrubTo.mock.calls[0][0] as number;
    const committedDate = new Date(committedAtMs);
    expect(committedDate.getUTCFullYear()).toBe(2026);
    expect(committedDate.getUTCMonth()).toBe(5);
    expect(committedDate.getUTCDate()).toBe(21);
    expect(committedDate.getUTCHours()).toBe(15);
  });
});
