/**
 * Phase 9 (Globe), Slice 5 -- the map/globe view switch in Reach's chrome.
 * `react-globe.gl` needs a WebGL context jsdom doesn't provide, so it's
 * mocked to a stub here (same convention as `HfPropagationGlobe.test.tsx`).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCoverageWorkerHandler } from '@integrations/propagation/coverageWorkerHandler';
import type {
  CoverageGridWorkerMessage,
  CoverageGridWorkerResponse,
} from '@integrations/propagation/protocol';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import { ViewerStateProvider } from '../../state/viewerState.tsx';

class FakeCoverageWorker {
  onmessage: ((event: MessageEvent<CoverageGridWorkerResponse>) => void) | null = null;
  private readonly handle = createCoverageWorkerHandler((response) => {
    queueMicrotask(() => {
      this.onmessage?.({ data: response } as MessageEvent<CoverageGridWorkerResponse>);
    });
  });
  private postCount = 0;

  postMessage(message: CoverageGridWorkerMessage): void {
    this.postCount += 1;
    queueMicrotask(() => this.handle(message));
  }

  terminate(): void {
    // no real thread to stop
  }

  get computeCount(): number {
    return this.postCount;
  }
}

let lastWorker: FakeCoverageWorker | null = null;

vi.mock('@integrations/propagation/coverageGridClient', async () => {
  const actual = await vi.importActual<
    typeof import('@integrations/propagation/coverageGridClient')
  >('@integrations/propagation/coverageGridClient');
  return {
    ...actual,
    CoverageGridClient: class extends actual.CoverageGridClient {
      constructor() {
        super(() => {
          lastWorker = new FakeCoverageWorker();
          return lastWorker;
        });
      }
    },
  };
});

vi.mock('react-globe.gl', () => ({
  default: () => <div data-testid="globe-stub" />,
}));

const { default: ReachPage } = await import('./ReachPage.tsx');

beforeEach(() => {
  localStorage.clear();
  lastWorker = null;
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

describe('ReachPage map/globe view switch', () => {
  it('defaults to the 2D map view', async () => {
    const { container } = renderReachPage();
    await waitFor(() => {
      expect(container.querySelector('.leaflet-container')).not.toBeNull();
    });
    expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument();
    expect(screen.queryByTestId('globe-stub')).not.toBeInTheDocument();
  });

  it('switching to Globe mounts the globe and hides the 2D-only controls', async () => {
    const { container } = renderReachPage();
    await waitFor(() => {
      expect(container.querySelector('.leaflet-container')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Globe' }));

    await waitFor(() => {
      expect(screen.getByTestId('globe-stub')).toBeInTheDocument();
    });
    expect(container.querySelector('.leaflet-container')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Coverage shading legend')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Greyline (day/night terminator)')).not.toBeInTheDocument();

    // The globe's own Display panel controls appear instead.
    expect(screen.getByRole('slider', { name: 'Altitude exaggeration' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cutaway plane')).toBeInTheDocument();
  });

  it('switching map -> globe -> map does not trigger a fresh coverage compute (F6.3 AC)', async () => {
    const { container } = renderReachPage();
    await waitFor(() => {
      expect(container.querySelector('canvas.reach-coverage-canvas')).not.toBeNull();
    });
    const worker = lastWorker!;
    await waitFor(() => expect(worker.computeCount).toBeGreaterThan(0));
    const countAfterInitialLoad = worker.computeCount;

    fireEvent.click(screen.getByRole('button', { name: 'Globe' }));
    await waitFor(() => {
      expect(screen.getByTestId('globe-stub')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    await waitFor(() => {
      expect(container.querySelector('.leaflet-container')).not.toBeNull();
    });

    // Give any accidental re-trigger a moment to fire before asserting the
    // count never moved off what the initial load alone produced.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(worker.computeCount).toBe(countAfterInitialLoad);
  });
});
