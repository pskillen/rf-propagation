import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BandDefinition } from '@core/domain/bandCatalog';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import FrequencyField from './FrequencyField.tsx';

const BAND_40M: BandDefinition = {
  id: '40m',
  label: '40 m',
  minMhz: 7.0,
  maxMhz: 7.2,
  color: '#2f9e44',
  mantine: 'green.7',
  category: 'amateur',
};

function renderField(frequencyMhz = 7.1, onChange = vi.fn(), band = BAND_40M) {
  render(
    <DesignSystemV2Provider>
      <FrequencyField band={band} frequencyMhz={frequencyMhz} onChange={onChange} />
    </DesignSystemV2Provider>,
  );
  return onChange;
}

describe('FrequencyField', () => {
  it('does not call onChange on every keystroke', () => {
    const onChange = renderField();
    const input = screen.getByLabelText('Frequency (MHz)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '7.05' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits a value inside the band range on blur', () => {
    const onChange = renderField(7.1);
    const input = screen.getByLabelText('Frequency (MHz)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '7.05' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(7.05);
  });

  it('clamps a value above the band max to the max on blur', () => {
    const onChange = renderField(7.1);
    const input = screen.getByLabelText('Frequency (MHz)') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(7.2);
    expect(input.value).toBe('7.2');
  });

  it('clamps a value below the band min to the min on blur', () => {
    const onChange = renderField(7.1);
    const input = screen.getByLabelText('Frequency (MHz)') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(7.0);
  });

  it('resets its draft to the new frequency when the band (and frequency prop) changes externally', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <DesignSystemV2Provider>
        <FrequencyField band={BAND_40M} frequencyMhz={7.1} onChange={onChange} />
      </DesignSystemV2Provider>,
    );
    const BAND_20M: BandDefinition = {
      id: '20m',
      label: '20 m',
      minMhz: 14.0,
      maxMhz: 14.35,
      color: '#0ca678',
      mantine: 'teal.7',
      category: 'amateur',
    };
    rerender(
      <DesignSystemV2Provider>
        <FrequencyField band={BAND_20M} frequencyMhz={14.175} onChange={onChange} />
      </DesignSystemV2Provider>,
    );
    const input = screen.getByLabelText('Frequency (MHz)') as HTMLInputElement;
    expect(input.value).toBe('14.175');
  });
});
