import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import PowerInput from './PowerInput.tsx';

beforeEach(() => {
  localStorage.clear();
});

function renderInput(powerW = 100, onStationChange = vi.fn(), unlocked = false) {
  render(
    <DesignSystemV2Provider>
      <PowerInput powerW={powerW} onStationChange={onStationChange} unlocked={unlocked} />
    </DesignSystemV2Provider>,
  );
  return onStationChange;
}

describe('PowerInput', () => {
  it('does not call onStationChange on every keystroke', () => {
    const onStationChange = renderInput();
    const input = screen.getByLabelText('TX power (W)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.change(input, { target: { value: '40' } });
    fireEvent.change(input, { target: { value: '400' } });
    expect(onStationChange).not.toHaveBeenCalled();
  });

  it('commits on blur', () => {
    const onStationChange = renderInput();
    const input = screen.getByLabelText('TX power (W)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '400' } });
    fireEvent.blur(input);

    expect(onStationChange).toHaveBeenCalledTimes(1);
    expect(onStationChange.mock.calls[0][0].powerW).toBe(400);
  });

  it('commits on Enter', () => {
    const onStationChange = renderInput();
    const input = screen.getByLabelText('TX power (W)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onStationChange).toHaveBeenCalledTimes(1);
    expect(onStationChange.mock.calls[0][0].powerW).toBe(50);
  });

  it('reverts to the last committed value on blur for a non-positive input', () => {
    const onStationChange = renderInput(100);
    const input = screen.getByLabelText('TX power (W)') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.blur(input);

    expect(onStationChange).not.toHaveBeenCalled();
    expect(input.value).toBe('100');
  });

  it('does not call onStationChange when blurring without changing the value', () => {
    const onStationChange = renderInput(100);
    const input = screen.getByLabelText('TX power (W)');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onStationChange).not.toHaveBeenCalled();
  });

  it('locked, clamps a value above 1500 W to 1500 on commit', () => {
    const onStationChange = renderInput(100);
    const input = screen.getByLabelText('TX power (W)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(onStationChange.mock.calls[0][0].powerW).toBe(1500);
  });

  it('unlocked, accepts a value up to 100,000 W', () => {
    const onStationChange = renderInput(100, vi.fn(), true);
    const input = screen.getByLabelText('TX power (W)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);
    expect(onStationChange.mock.calls[0][0].powerW).toBe(5000);
  });

  it('marks the field out-of-bounds when the current value is above 1500 W, regardless of the toggle', () => {
    renderInput(5000, vi.fn(), true);
    expect(screen.getByText('Outside the realistic amateur range')).toBeInTheDocument();
  });
});
