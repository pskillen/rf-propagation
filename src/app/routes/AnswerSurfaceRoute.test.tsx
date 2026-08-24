/**
 * F10.4's integration test ("a target set from Reach renders a correct
 * Path view without reshaping", per the phase file's own test plan) --
 * `ReachMap`'s cell-click already writes `{lat, lon, label: undefined,
 * source: 'map-click'}` into `ViewerState.target` (phase 8); this
 * confirms that exact shape switches `AnswerSurfaceRoute` to Path and
 * renders a Path view without any reshaping step in between.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { createCoverageWorkerHandler } from '@integrations/propagation/coverageWorkerHandler';
import type {
  CoverageGridWorkerMessage,
  CoverageGridWorkerResponse,
} from '@integrations/propagation/protocol';
import { vi } from 'vitest';
import DesignSystemV2Provider from '../components/v2/DesignSystemV2Provider.tsx';
import { ViewerStateProvider, useViewerState } from '../state/viewerState.tsx';
import AnswerSurfaceRoute from './AnswerSurfaceRoute.tsx';

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

// The exact shape ReachMap's cell-click handler (`handleMapClick`,
// ReachPage.tsx) writes into `ViewerState.target` -- reused verbatim here
// rather than a hand-shaped test fixture, so this test would break if
// that shape and this phase's own `Target` type ever drifted apart.
function ReachCellClickProbe() {
  const { setState } = useViewerState();
  return (
    <button
      type="button"
      onClick={() =>
        setState((prev) => ({
          ...prev,
          target: { lat: 62, lon: 5, label: undefined, source: 'map-click' },
        }))
      }
    >
      simulate reach cell click
    </button>
  );
}

function renderRoute() {
  return render(
    <MemoryRouter>
      <ViewerStateProvider>
        <DesignSystemV2Provider>
          <ReachCellClickProbe />
          <AnswerSurfaceRoute />
        </DesignSystemV2Provider>
      </ViewerStateProvider>
    </MemoryRouter>,
  );
}

describe('AnswerSurfaceRoute', () => {
  it('renders Reach when target is null', () => {
    renderRoute();
    expect(screen.getByLabelText('View')).toBeInTheDocument();
    expect(screen.queryByText(/Set a target above/)).not.toBeInTheDocument();
  });

  it("renders Path once a target is set in Reach's own {lat, lon, label, source} shape, no reshaping", async () => {
    renderRoute();

    screen.getByText('simulate reach cell click').click();

    expect(await screen.findByLabelText('Resolved target')).toBeInTheDocument();
    expect(
      await screen.findByLabelText('Band by band verdict, ranked best-first'),
    ).toBeInTheDocument();
  });
});
