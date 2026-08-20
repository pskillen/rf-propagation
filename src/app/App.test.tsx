// Reset-to-defaults (F7.2, phase 10's Slice 2) is wired at App.tsx's
// `Shell` level (it needs the shared Conditions clock, `ViewerState`,
// the URL codec, and the router all at once), so it's exercised here
// against the full `App` component rather than a smaller harness.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCoverageWorkerHandler } from '@integrations/propagation/coverageWorkerHandler';
import type {
  CoverageGridWorkerMessage,
  CoverageGridWorkerResponse,
} from '@integrations/propagation/protocol';
import { loadStation } from '@integrations/station/persistence';
import DesignSystemV2Provider from './components/v2/DesignSystemV2Provider.tsx';
import App from './App.tsx';

class FakeCoverageWorker {
  onmessage: ((event: MessageEvent<CoverageGridWorkerResponse>) => void) | null = null;
  private readonly handle = createCoverageWorkerHandler((response) => {
    queueMicrotask(() => {
      this.onmessage?.({ data: response } as MessageEvent<CoverageGridWorkerResponse>);
    });
  });

  postMessage(message: CoverageGridWorkerMessage): void {
    queueMicrotask(() => this.handle(message));
  }

  terminate(): void {
    // no real thread to stop
  }
}

vi.mock('@integrations/propagation/coverageGridClient', async () => {
  const actual = await vi.importActual<
    typeof import('@integrations/propagation/coverageGridClient')
  >('@integrations/propagation/coverageGridClient');
  return {
    ...actual,
    CoverageGridClient: class extends actual.CoverageGridClient {
      constructor() {
        super(() => new FakeCoverageWorker());
      }
    },
  };
});

vi.mock('@integrations/spaceWeather/noaaClient', () => ({
  fetchLatestSpaceWeather: () => new Promise(() => {}), // never resolves
}));

vi.mock('@integrations/conditions/persistence', () => ({
  loadLastKnownDriver: () => null,
  saveLastKnownDriver: () => {},
}));

// `createBrowserRouter`'s internal history object is created once (at
// this module's first import) and only updates on its OWN navigate
// calls or a `popstate` event -- a bare `window.history.pushState()`
// bypasses it entirely, leaving `useSearchParams()` stale. Dispatching
// `popstate` after `pushState` is what makes a pre-seeded URL actually
// visible to the router (confirmed empirically; not documented anywhere
// obvious in react-router's own docs).
function navigateTo(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

beforeEach(() => {
  localStorage.clear();
  navigateTo('/');
});

describe('App reset-to-defaults', () => {
  it('restores the default Station, clears a non-default URL, and persists the default Station', async () => {
    // A non-default starting point: a manual band override in the URL
    // (F7.2's own "reload after reset doesn't resurrect the pre-reset
    // state" AC -- the strongest test of that is starting from a URL
    // that ISN'T the default).
    navigateTo('/?b=20m');

    render(
      <DesignSystemV2Provider>
        <App />
      </DesignSystemV2Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/20 m @/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    await waitFor(() => {
      expect(screen.getByText(/40 m @ 7.1 MHz/)).toBeInTheDocument();
    });
    // The URL never goes fully empty -- ConditionsBar's own url-write
    // effect always encodes driver/ground/band, default or not (see
    // conditionsFieldCodec's own doc comment) -- so the meaningful
    // assertion is "the non-default override is gone," not "the query
    // string is empty."
    expect(window.location.search).not.toContain('b=20m');
    expect(window.location.search).toContain('b=40m');
    expect(loadStation()).toEqual(expect.objectContaining({ powerW: 100 }));
  });

  it('stops active playback on reset', async () => {
    render(
      <DesignSystemV2Provider>
        <App />
      </DesignSystemV2Provider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    });
  });
});
