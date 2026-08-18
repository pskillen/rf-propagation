import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { ViewerStateProvider } from '../../state/viewerState.tsx';
import StationBar from './StationBar.tsx';

vi.mock('./QthMap.tsx', () => ({
  default: () => <div data-testid="qth-map-stub" />,
}));

beforeEach(() => {
  localStorage.clear();
});

function renderBar() {
  return render(
    <ViewerStateProvider>
      <DesignSystemV2Provider>
        <StationBar />
      </DesignSystemV2Provider>
    </ViewerStateProvider>,
  );
}

describe('StationBar', () => {
  it('renders a populated default station on first load, no wizard/modal/empty state', () => {
    renderBar();

    expect(screen.getByTestId('station-bar')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(DEFAULT_STATION.qth.locator))).toBeInTheDocument();
    expect(screen.getByText(/40m dipole/)).toBeInTheDocument();
    expect(screen.getByText(/100 W/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the TX power field is reachable and functional without clicking Edit', () => {
    renderBar();

    // Not behind the "Edit station" toggle — visible from first paint.
    const input = screen.getByLabelText('TX power (W)');
    expect(input).toBeEnabled();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '400' } });
    fireEvent.blur(input);

    expect(screen.getByText(/400 W/)).toBeInTheDocument();
  });

  it('reveals QTH, Antennas and Noise environment sections behind the Edit toggle', () => {
    renderBar();

    expect(screen.queryByText('QTH')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit station' }));

    expect(screen.getByText('QTH')).toBeInTheDocument();
    expect(screen.getByText('Antennas')).toBeInTheDocument();
    expect(screen.getByText('Noise environment')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('QTH')).not.toBeInTheDocument();
  });

  it('persists a change across a fresh mount (simulated reload)', () => {
    const first = renderBar();
    const input = screen.getByLabelText('TX power (W)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '250' } });
    fireEvent.blur(input);
    first.unmount();

    renderBar();
    expect(screen.getByText(/250 W/)).toBeInTheDocument();
  });
});
