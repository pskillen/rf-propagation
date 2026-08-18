import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCoverageWorkerHandler } from '@integrations/propagation/coverageWorkerHandler';
import type {
  CoverageGridWorkerMessage,
  CoverageGridWorkerResponse,
} from '@integrations/propagation/protocol';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
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

function renderReachPage() {
  return render(
    <ViewerStateProvider>
      <DesignSystemV2Provider>
        <ReachPage />
      </DesignSystemV2Provider>
    </ViewerStateProvider>,
  );
}

describe('ReachPage', () => {
  it('renders the Reach map with the current station marker', async () => {
    const { container } = renderReachPage();

    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    await waitFor(() => {
      expect(container.querySelector('.leaflet-marker-icon')).not.toBeNull();
    });
  });

  it('mounts a coverage canvas layer once the initial coverage grid resolves', async () => {
    const { container } = renderReachPage();

    await waitFor(() => {
      expect(container.querySelector('canvas.reach-coverage-canvas')).not.toBeNull();
    });
  });

  it('shows the summary strip and legend, and eventually a ranked best band', async () => {
    renderReachPage();

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

  it('clicking the map sets a target and shows the target panel; clearing removes it (Slice 5)', async () => {
    const { container } = renderReachPage();

    await waitFor(() => {
      expect(container.querySelector('.leaflet-container')).not.toBeNull();
    });

    expect(screen.queryByLabelText('Selected target')).not.toBeInTheDocument();

    const mapEl = container.querySelector('.leaflet-container') as HTMLElement;
    fireEvent.click(mapEl);

    await waitFor(() => {
      expect(screen.getByLabelText('Selected target')).toBeInTheDocument();
    });
    // A second marker (the target) alongside the station marker.
    await waitFor(() => {
      expect(container.querySelectorAll('.leaflet-marker-icon')).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear target' }));
    expect(screen.queryByLabelText('Selected target')).not.toBeInTheDocument();
  });

  it('the greyline toggle defaults on, and switching it off hides the terminator layer (Slice 5)', async () => {
    const { container } = renderReachPage();

    await waitFor(() => {
      expect(container.querySelectorAll('.leaflet-overlay-pane path').length).toBeGreaterThan(0);
    });

    const toggle = screen.getByLabelText('Greyline (day/night terminator)');
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(container.querySelectorAll('.leaflet-overlay-pane path')).toHaveLength(0);
    });
    expect(toggle).not.toBeChecked();
  });
});
