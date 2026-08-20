import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import { DEFAULT_TIMELINE_STATE } from '../../state/timeline.ts';
import ReferenceDistanceControl from './ReferenceDistanceControl.tsx';

function renderControl(value = DEFAULT_TIMELINE_STATE, onChange = vi.fn()) {
  render(
    <DesignSystemV2Provider>
      <ReferenceDistanceControl value={value} onChange={onChange} />
    </DesignSystemV2Provider>,
  );
  return onChange;
}

describe('ReferenceDistanceControl', () => {
  it('does not call onChange on every keystroke', () => {
    const onChange = renderControl();
    const input = screen.getByLabelText('Reference distance (km)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '4000' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits the distance on blur', () => {
    const onChange = renderControl();
    const input = screen.getByLabelText('Reference distance (km)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '5000' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual({
      referenceDistanceKm: 5000,
      referenceBearingDeg: DEFAULT_TIMELINE_STATE.referenceBearingDeg,
    });
  });

  it('commits the bearing on Enter, wrapping to 0-360', () => {
    const onChange = renderControl();
    const input = screen.getByLabelText('Reference bearing (°T)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '400' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].referenceBearingDeg).toBe(40);
  });

  it('does not call onChange when blurring without changing the value', () => {
    const onChange = renderControl();
    const input = screen.getByLabelText('Reference distance (km)');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });
});
