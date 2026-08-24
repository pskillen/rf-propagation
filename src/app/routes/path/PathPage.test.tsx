import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import { ViewerStateProvider, useViewerState } from '../../state/viewerState.tsx';
import PathPage from './PathPage.tsx';

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

function renderPathPage() {
  return render(
    <MemoryRouter>
      <ViewerStateProvider>
        <DesignSystemV2Provider>
          <TargetProbe lat={62} lon={5} />
          <PathPage />
        </DesignSystemV2Provider>
      </ViewerStateProvider>
    </MemoryRouter>,
  );
}

describe('PathPage', () => {
  it('shows the target picker empty state when no target is set', () => {
    renderPathPage();
    expect(screen.getByText(/Set a target above/)).toBeInTheDocument();
  });

  it('shows a band-by-band verdict table and geometry summary once a target is set', async () => {
    renderPathPage();

    screen.getByText('set target').click();

    expect(
      await screen.findByLabelText('Band by band verdict, ranked best-first'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Geometry summary')).toBeInTheDocument();
  });
});
