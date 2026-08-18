import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import VerticalCrossSection from './VerticalCrossSection.tsx';

const BANDS = [
  { layer: 'E' as const, heightKm: 110 },
  { layer: 'F2' as const, heightKm: 300 },
];

describe('VerticalCrossSection', () => {
  it('renders a labelled x-axis and y-axis (F8.1 acceptance criterion)', () => {
    const { getByText } = render(
      <VerticalCrossSection
        bands={BANDS}
        maxRangeKm={3000}
        primaryRayPoints={[]}
        bearingDeg={90}
      />,
    );
    expect(getByText('Altitude (km)')).toBeInTheDocument();
    expect(getByText('Ground distance (km)')).toBeInTheDocument();
  });

  it('draws one line per active band, labelled with the layer id', () => {
    const { getByText } = render(
      <VerticalCrossSection
        bands={BANDS}
        maxRangeKm={3000}
        primaryRayPoints={[]}
        bearingDeg={90}
      />,
    );
    expect(getByText('E')).toBeInTheDocument();
    expect(getByText('F2')).toBeInTheDocument();
  });

  it('renders no target marker when target is unset', () => {
    const { queryByTestId } = render(
      <VerticalCrossSection
        bands={BANDS}
        maxRangeKm={3000}
        primaryRayPoints={[]}
        bearingDeg={90}
      />,
    );
    expect(queryByTestId('target-marker')).toBeNull();
  });

  it('renders a target marker line at the target range (Path mode, FR-18)', () => {
    const { queryByTestId } = render(
      <VerticalCrossSection
        bands={BANDS}
        maxRangeKm={3000}
        primaryRayPoints={[]}
        targetRangeKm={1500}
        bearingDeg={90}
      />,
    );
    expect(queryByTestId('target-marker')).not.toBeNull();
  });
});
