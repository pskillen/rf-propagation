import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { createCoverageWorkerHandler } from '@integrations/propagation/coverageWorkerHandler';
import type {
  CoverageGridWorkerMessage,
  CoverageGridWorkerResponse,
} from '@integrations/propagation/protocol';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import { ViewerStateProvider, useViewerState } from '../../state/viewerState.tsx';
import ComparePage from './ComparePage.tsx';

// Same fake-worker-wired-to-the-real-handler pattern ReachPage.test.tsx
// already uses (jsdom has no real Worker) -- Compare mounts two
// independent `useReachCoverage` clients (one per side), both of which
// go through this same mock.
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

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
});

function renderComparePage() {
  return render(
    <MemoryRouter>
      <ViewerStateProvider>
        <DesignSystemV2Provider>
          <ComparePage />
        </DesignSystemV2Provider>
      </ViewerStateProvider>
    </MemoryRouter>,
  );
}

function renderComparePageWithTarget() {
  function TargetProbe() {
    const { setState } = useViewerState();
    return (
      <button
        type="button"
        onClick={() =>
          setState((prev) => ({
            ...prev,
            target: {
              lat: prev.station.qth.lat + 15,
              lon: prev.station.qth.lon + 15,
              source: 'map-click',
            },
          }))
        }
      >
        set target
      </button>
    );
  }
  return render(
    <MemoryRouter>
      <ViewerStateProvider>
        <DesignSystemV2Provider>
          <TargetProbe />
          <ComparePage />
        </DesignSystemV2Provider>
      </ViewerStateProvider>
    </MemoryRouter>,
  );
}

describe('ComparePage', () => {
  it('shows the disabled note until Compare is turned on', () => {
    renderComparePage();
    expect(screen.getByText(/Turn on Compare/)).toBeInTheDocument();
  });

  it('renders two coverage columns side by side once Compare is enabled (no target)', async () => {
    renderComparePage();

    fireEvent.click(screen.getByLabelText('Compare'));

    expect(screen.getByText('Current')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryAllByText(/groundwave|hop|No coverage/).length).toBeGreaterThan(0);
    });
  });

  it('shows a verdict table with a per-mode dB delta once a target is set', async () => {
    renderComparePageWithTarget();

    fireEvent.click(screen.getByText('set target'));
    fireEvent.click(screen.getByLabelText('Compare'));

    await waitFor(() => {
      expect(screen.getByLabelText('Verdict comparison')).toBeInTheDocument();
    });
    expect(screen.getByText('SSB')).toBeInTheDocument();
  });
});
