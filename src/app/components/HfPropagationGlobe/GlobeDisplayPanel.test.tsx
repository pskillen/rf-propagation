import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_GLOBE_TOGGLES } from '../../state/globeToggles.ts';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import GlobeDisplayPanel from './GlobeDisplayPanel.tsx';

function renderPanel(value = DEFAULT_GLOBE_TOGGLES) {
  const onChange = vi.fn();
  render(
    <DesignSystemV2Provider>
      <GlobeDisplayPanel value={value} onChange={onChange} />
    </DesignSystemV2Provider>,
  );
  return onChange;
}

describe('GlobeDisplayPanel', () => {
  it('renders all four ShellDisplayOptions controls plus the terminator toggle', () => {
    renderPanel();
    expect(screen.getByRole('slider', { name: 'Altitude exaggeration' })).toBeInTheDocument();
    expect(screen.getByLabelText('Exploded layer stacking')).toBeInTheDocument();
    expect(screen.getByLabelText('Fresnel shading')).toBeInTheDocument();
    expect(screen.getByLabelText('Day/night terminator')).toBeInTheDocument();
    expect(screen.getByLabelText('Cutaway plane')).toBeInTheDocument();
  });

  it('reflects the current value as checked/unchecked', () => {
    renderPanel({ ...DEFAULT_GLOBE_TOGGLES, explodeEnabled: true, fresnelEnabled: false });
    expect(screen.getByLabelText('Exploded layer stacking')).toBeChecked();
    expect(screen.getByLabelText('Fresnel shading')).not.toBeChecked();
  });

  it('toggling Exploded layer stacking calls onChange with only that field flipped', () => {
    const onChange = renderPanel();
    fireEvent.click(screen.getByLabelText('Exploded layer stacking'));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_GLOBE_TOGGLES, explodeEnabled: true });
  });

  it('toggling the terminator toggle calls onChange with only that field flipped', () => {
    const onChange = renderPanel();
    fireEvent.click(screen.getByLabelText('Day/night terminator'));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_GLOBE_TOGGLES, terminatorEnabled: true });
  });

  it('toggling the cutaway toggle calls onChange with only that field flipped', () => {
    const onChange = renderPanel();
    fireEvent.click(screen.getByLabelText('Cutaway plane'));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_GLOBE_TOGGLES, cutawayEnabled: true });
  });

  it('the exaggeration slider responds continuously (onChange, not onChangeEnd) -- a keyboard nudge fires onChange immediately', () => {
    const onChange = renderPanel();
    const slider = screen.getByRole('slider', { name: 'Altitude exaggeration' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.exaggerationFactor).toBeGreaterThan(DEFAULT_GLOBE_TOGGLES.exaggerationFactor);
    // Only exaggerationFactor changed -- every other field stays exactly as given.
    expect({ ...lastCall, exaggerationFactor: DEFAULT_GLOBE_TOGGLES.exaggerationFactor }).toEqual(
      DEFAULT_GLOBE_TOGGLES,
    );
  });
});
