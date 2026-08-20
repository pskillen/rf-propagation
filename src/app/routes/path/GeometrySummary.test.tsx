import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { HopSolution } from '@core/domain/propagation/multiHop';
import type { Station } from '@core/domain/station/types';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { ViewerStateProvider, useViewerState } from '../../state/viewerState.tsx';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import GeometrySummary from './GeometrySummary.tsx';

const HOP_SOLUTION: HopSolution = {
  hopCount: 2,
  layer: 'F2',
  hops: [
    {
      takeoffAngleRad: (8 * Math.PI) / 180,
      layer: 'F2',
      virtualHeightKm: 300,
      groundRangeKm: 1680,
      slantPathKm: 1700,
      solarZenithAtMidpointDeg: 0,
      mufMhz: 20,
    },
  ],
  linkBudget: {
    eirpDbm: 0,
    fsplDb: 0,
    absorptionDb: 0,
    groundReflectionDb: 0,
    polarisationDb: 0,
    receivedPowerDbm: 0,
    noiseFloorDbm: 0,
    snrDb2400: 0,
    mufMhz: 20,
  },
};

const STATION_WITH_TWO_ANTENNAS: Station = {
  ...DEFAULT_STATION,
  antennas: [
    ...DEFAULT_STATION.antennas,
    {
      id: 'vertical-1',
      name: 'Vertical',
      family: 'omnidirectional-vertical',
      heightM: 10,
      gainDbi: 3,
    },
  ],
};

function CompareStateProbe() {
  const { state } = useViewerState();
  return <pre data-testid="compare-state">{JSON.stringify(state.compare)}</pre>;
}

function renderSummary() {
  return render(
    <MemoryRouter>
      <ViewerStateProvider>
        <DesignSystemV2Provider>
          <GeometrySummary
            hopSolution={HOP_SOLUTION}
            station={STATION_WITH_TWO_ANTENNAS}
            activeAntenna={STATION_WITH_TWO_ANTENNAS.antennas[0]!}
            bearingDeg={90}
            frequencyMhz={14.15}
          />
          <CompareStateProbe />
        </DesignSystemV2Provider>
      </ViewerStateProvider>
    </MemoryRouter>,
  );
}

describe('GeometrySummary', () => {
  it('renders hop count, layer and required takeoff angle', () => {
    renderSummary();
    expect(screen.getByLabelText('Geometry summary')).toHaveTextContent(
      '2-hop path via the F2 layer',
    );
    expect(screen.getByText(/8\.0/)).toBeInTheDocument();
  });

  it('sets compare.enabled and againstAntennaId, and navigates, when "Compare with" is clicked', () => {
    renderSummary();
    fireEvent.click(screen.getByText(/Compare with/));

    const compareState = JSON.parse(screen.getByTestId('compare-state').textContent ?? '{}');
    expect(compareState.enabled).toBe(true);
    expect(compareState.againstAntennaId).toBe('vertical-1');
  });
});
