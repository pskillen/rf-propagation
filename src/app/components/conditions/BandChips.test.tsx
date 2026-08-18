import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import BandChips from './BandChips.tsx';

function renderChips(bandId = '40m', onChange = vi.fn()) {
  render(
    <DesignSystemV2Provider>
      <BandChips bandId={bandId} onChange={onChange} />
    </DesignSystemV2Provider>,
  );
  return onChange;
}

describe('BandChips', () => {
  it('renders all ten amateur HF band chips', () => {
    renderChips();
    const group = screen.getByRole('group', { name: 'Band' });
    for (const label of [
      '160 m',
      '80 m',
      '60 m',
      '40 m',
      '30 m',
      '20 m',
      '17 m',
      '15 m',
      '12 m',
      '10 m',
    ]) {
      expect(group.textContent).toContain(label);
    }
    expect(screen.getAllByRole('button')).toHaveLength(10);
  });

  it('marks the current band as pressed', () => {
    renderChips('20m');
    const pressed = screen
      .getAllByRole('button')
      .find((btn) => btn.getAttribute('aria-pressed') === 'true');
    expect(pressed?.textContent).toContain('20 m');
  });

  it('calls onChange with the clicked band id', () => {
    const onChange = renderChips('40m');
    const button = screen.getAllByRole('button').find((btn) => btn.textContent?.startsWith('20 m'));
    fireEvent.click(button!);
    expect(onChange).toHaveBeenCalledWith('20m');
  });

  it('renders notes inline for bands that have them (visibly distinguished, not hidden)', () => {
    renderChips();
    const group = screen.getByRole('group', { name: 'Band' });
    expect(group.textContent).toContain('Secondary allocation');
    expect(group.textContent).toContain('Simple range lookup');
  });
});
