import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ManualDriverFields from './ManualDriverFields.tsx';

function renderFields(sfi = 120, kp = 2, onCommit = vi.fn()) {
  render(
    <DesignSystemV2Provider>
      <ManualDriverFields sfi={sfi} kp={kp} onCommit={onCommit} />
    </DesignSystemV2Provider>,
  );
  return onCommit;
}

describe('ManualDriverFields', () => {
  it('does not call onCommit on every keystroke', () => {
    const onCommit = renderFields();
    const sfiInput = screen.getByLabelText('Solar Flux Index');
    fireEvent.focus(sfiInput);
    fireEvent.change(sfiInput, { target: { value: '1' } });
    fireEvent.change(sfiInput, { target: { value: '15' } });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits both fields on blur', () => {
    const onCommit = renderFields(120, 2);
    const sfiInput = screen.getByLabelText('Solar Flux Index');
    const kpInput = screen.getByLabelText('Kp index');
    fireEvent.focus(sfiInput);
    fireEvent.change(sfiInput, { target: { value: '180' } });
    fireEvent.blur(sfiInput);
    fireEvent.focus(kpInput);
    fireEvent.change(kpInput, { target: { value: '5' } });
    fireEvent.blur(kpInput);

    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit.mock.calls[0]).toEqual([180, 2]);
    expect(onCommit.mock.calls[1]).toEqual([180, 5]);
  });

  it('commits on Enter', () => {
    const onCommit = renderFields(120, 2);
    const sfiInput = screen.getByLabelText('Solar Flux Index');
    fireEvent.focus(sfiInput);
    fireEvent.change(sfiInput, { target: { value: '200' } });
    fireEvent.keyDown(sfiInput, { key: 'Enter' });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0]).toEqual([200, 2]);
  });

  it('rejects a Kp outside 0-9 and reverts to the last committed value', () => {
    const onCommit = renderFields(120, 2);
    const kpInput = screen.getByLabelText('Kp index') as HTMLInputElement;
    fireEvent.focus(kpInput);
    fireEvent.change(kpInput, { target: { value: '15' } });
    fireEvent.blur(kpInput);

    expect(onCommit).not.toHaveBeenCalled();
    expect(kpInput.value).toBe('2');
  });

  it('does not call onCommit when blurring without changing either value', () => {
    const onCommit = renderFields(120, 2);
    const sfiInput = screen.getByLabelText('Solar Flux Index');
    fireEvent.focus(sfiInput);
    fireEvent.blur(sfiInput);
    expect(onCommit).not.toHaveBeenCalled();
  });
});
