import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCoverageWorkerHandler } from '@integrations/propagation/coverageWorkerHandler';
import type {
  CoverageGridWorkerMessage,
  CoverageGridWorkerResponse,
} from '@integrations/propagation/protocol';
import { ViewerStateProvider } from '../../state/viewerState.tsx';
import ReachPage from './ReachPage.tsx';

// jsdom has no real Worker implementation (CoverageGridClient's default
// factory constructs one) -- replace it with the same fake-worker-wired-
// to-the-real-handler pattern coverageGridClient.test.ts and
// useReachCoverage.test.ts already use, so ReachPage exercises the real
// coarse-then-fine computation without touching an actual Worker thread.
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

describe('ReachPage', () => {
  it('renders the Reach map with the current station marker', async () => {
    const { container } = render(
      <ViewerStateProvider>
        <ReachPage />
      </ViewerStateProvider>,
    );

    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    await waitFor(() => {
      expect(container.querySelector('.leaflet-marker-icon')).not.toBeNull();
    });
  });

  it('mounts a coverage canvas layer once the initial coverage grid resolves', async () => {
    const { container } = render(
      <ViewerStateProvider>
        <ReachPage />
      </ViewerStateProvider>,
    );

    await waitFor(() => {
      expect(container.querySelector('canvas.reach-coverage-canvas')).not.toBeNull();
    });
  });

  it('shows the summary strip and legend, and eventually a ranked best band', async () => {
    render(
      <ViewerStateProvider>
        <ReachPage />
      </ViewerStateProvider>,
    );

    expect(screen.getByLabelText('Reach summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Coverage shading legend')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByText(/Ranking bands/)).not.toBeInTheDocument();
      },
      { timeout: 10_000 },
    );
    expect(screen.getByText(/reliability/)).toBeInTheDocument();
  }, 15_000);
});
