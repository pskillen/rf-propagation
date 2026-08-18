import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AntennaConfig } from '@core/domain/station/types';
import AntennaPatternPreview from './AntennaPatternPreview.tsx';

function dipole(heightM: number): AntennaConfig {
  return {
    id: 'a',
    name: 'Test dipole',
    family: 'bidirectional-transverse',
    heightM,
    azimuthDeg: 0,
    gainDbi: 2.1,
  };
}

describe('AntennaPatternPreview', () => {
  it('renders an SVG path for the antenna elevation pattern', () => {
    const { container } = render(<AntennaPatternPreview antenna={dipole(7)} />);
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('d')).toMatch(/^M /);
  });

  it('renders a visibly different pattern for a low vs a high dipole (NVIS vs DX)', () => {
    const low = render(<AntennaPatternPreview antenna={dipole(3)} />);
    const high = render(<AntennaPatternPreview antenna={dipole(15)} />);

    const lowPath = low.container.querySelector('path')?.getAttribute('d');
    const highPath = high.container.querySelector('path')?.getAttribute('d');

    expect(lowPath).toBeTruthy();
    expect(highPath).toBeTruthy();
    expect(lowPath).not.toBe(highPath);
  });
});
