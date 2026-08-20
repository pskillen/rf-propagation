import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import TargetPicker from './TargetPicker.tsx';

const STATION = { lat: 52.4862, lon: -1.8904 };

function renderPicker(target: Parameters<typeof TargetPicker>[0]['target'] = null) {
  const onTargetChange = vi.fn();
  render(
    <DesignSystemV2Provider>
      <TargetPicker station={STATION} target={target} onTargetChange={onTargetChange} />
    </DesignSystemV2Provider>,
  );
  return { onTargetChange };
}

describe('TargetPicker', () => {
  it('resolves a target from the coordinates mode', () => {
    const { onTargetChange } = renderPicker();

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '51.5074' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-0.1278' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));

    expect(onTargetChange).toHaveBeenCalledWith({
      lat: 51.5074,
      lon: -0.1278,
      source: 'coordinates',
    });
  });

  it('shows a validation error for an out-of-range coordinate rather than calling onTargetChange', () => {
    const { onTargetChange } = renderPicker();

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));

    expect(onTargetChange).not.toHaveBeenCalled();
    expect(screen.getByText(/latitude between -90 and 90/)).toBeInTheDocument();
  });

  it('resolves a target from a locator once the Locator mode is selected', () => {
    const { onTargetChange } = renderPicker();

    fireEvent.click(screen.getByText('Locator'));
    fireEvent.change(screen.getByLabelText('Maidenhead locator'), { target: { value: 'IO85vs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));

    expect(onTargetChange).toHaveBeenCalledTimes(1);
    const [resolved] = onTargetChange.mock.calls[0]!;
    expect(resolved.source).toBe('locator');
  });

  it('shows the resolved bearing and distance once a target is set', () => {
    renderPicker({ lat: 51.5074, lon: -0.1278, source: 'coordinates' });

    expect(screen.getByLabelText('Resolved target')).toBeInTheDocument();
    expect(screen.getByText(/°T ·/)).toBeInTheDocument();
    expect(screen.getByText(/km \(/)).toBeInTheDocument();
  });

  it('clears the target via the resolved-target readout', () => {
    const { onTargetChange } = renderPicker({ lat: 51.5074, lon: -0.1278, source: 'coordinates' });

    fireEvent.click(screen.getByText('Clear target'));
    expect(onTargetChange).toHaveBeenCalledWith(null);
  });
});
