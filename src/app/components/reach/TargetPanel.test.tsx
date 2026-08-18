import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import TargetPanel from './TargetPanel.tsx';

const STATION = { lat: 52.4862, lon: -1.8904 }; // DEFAULT_STATION's QTH

function renderPanel(target: { lat: number; lon: number }, onClear = vi.fn()) {
  return render(
    <DesignSystemV2Provider>
      <TargetPanel station={STATION} target={target} onClear={onClear} />
    </DesignSystemV2Provider>,
  );
}

describe('TargetPanel', () => {
  it('shows the target coordinate, bearing and range from the station', () => {
    // Roughly Cardiff, south-west of the default station.
    renderPanel({ lat: 51.48, lon: -3.18 });
    expect(screen.getByLabelText('Selected target')).toBeInTheDocument();
    expect(screen.getByText(/Target: 51\.5°N 3\.2°W/)).toBeInTheDocument();
    expect(screen.getByText(/bearing \d+°/)).toBeInTheDocument();
    expect(screen.getByText(/\d+ km/)).toBeInTheDocument();
  });

  it('calls onClear when the clear affordance is used', () => {
    const onClear = vi.fn();
    renderPanel({ lat: 51.48, lon: -3.18 }, onClear);
    fireEvent.click(screen.getByRole('button', { name: 'Clear target' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
