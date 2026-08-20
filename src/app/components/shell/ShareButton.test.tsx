import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import { ViewerStateProvider, useViewerState } from '../../state/viewerState.tsx';
import ShareButton from './ShareButton.tsx';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
  window.history.pushState({}, '', '/');
});

function SetTargetProbe() {
  const { setState } = useViewerState();
  return (
    <button
      type="button"
      onClick={() =>
        setState((prev) => ({ ...prev, target: { lat: 40, lon: 10, source: 'map-click' } }))
      }
    >
      set target
    </button>
  );
}

function renderButton() {
  render(
    <ViewerStateProvider>
      <DesignSystemV2Provider>
        <SetTargetProbe />
        <ShareButton />
      </DesignSystemV2Provider>
    </ViewerStateProvider>,
  );
}

describe('ShareButton', () => {
  it('copies a URL built from the current ViewerState to the clipboard', async () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const url = writeText.mock.calls[0][0] as string;
    expect(url).toContain(window.location.origin);
    expect(url).toContain('v=1');
  });

  it('includes a state change made after mount (e.g. a selected target)', async () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'set target' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const url = writeText.mock.calls[0][0] as string;
    expect(url).toContain('tlat=40');
    expect(url).toContain('tlon=10');
  });

  it('shows a brief "Link copied" confirmation after copying', async () => {
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument();
    });
  });
});
