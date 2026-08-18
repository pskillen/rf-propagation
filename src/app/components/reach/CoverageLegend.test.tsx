import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CoverageLegend from './CoverageLegend.tsx';

describe('CoverageLegend', () => {
  it('lists groundwave, hop 1-4 and the skip zone', () => {
    render(<CoverageLegend />);

    expect(screen.getByText('Groundwave')).toBeInTheDocument();
    expect(screen.getByText('Hop 1')).toBeInTheDocument();
    expect(screen.getByText('Hop 2')).toBeInTheDocument();
    expect(screen.getByText('Hop 3')).toBeInTheDocument();
    expect(screen.getByText('Hop 4')).toBeInTheDocument();
    expect(screen.getByText(/Skip zone/)).toBeInTheDocument();
  });

  it('explains the skip zone as a deliberate absence, not missing data (F5.3)', () => {
    render(<CoverageLegend />);
    expect(screen.getByText(/checked and empty \(not missing data\)/)).toBeInTheDocument();
  });

  it('is always visible (no jargon-popover dependency) and labelled for a11y', () => {
    render(<CoverageLegend />);
    expect(screen.getByLabelText('Coverage shading legend')).toBeInTheDocument();
  });
});
