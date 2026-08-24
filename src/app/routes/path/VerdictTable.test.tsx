import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { layerStates } from '@core/domain/propagation/layers';
import { ssnFromSfi } from '@core/domain/propagation/losses';
import type { SolveHopsContext } from '@core/domain/propagation/multiHop';
import { buildVerdictTable } from '@core/domain/propagation/verdictTable';
import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import { ViewerStateProvider } from '../../state/viewerState.tsx';
import type { Target } from '../../state/viewerState.tsx';
import VerdictTable from './VerdictTable.tsx';

const TARGET: Target = { lat: 10, lon: 20, source: 'coordinates' };

function contextAt(sfi: number, solarZenithDeg: number): SolveHopsContext {
  return {
    groundType: 'land',
    noiseEnvironment: 'rural',
    txPowerW: 100,
    txAntennaGainDbi: 6,
    rxAntennaGainDbi: 6,
    bandwidthHz: 2400,
    ssn: ssnFromSfi(sfi),
    solarZenithAtMidpointDeg: () => solarZenithDeg,
  };
}

function renderTable(rows: ReturnType<typeof buildVerdictTable>) {
  return render(
    <MemoryRouter>
      <ViewerStateProvider>
        <VerdictTable rows={rows} target={TARGET} />
      </ViewerStateProvider>
    </MemoryRouter>,
  );
}

describe('VerdictTable', () => {
  it('renders a row per band with per-mode verdict cells, best band first', () => {
    const layers = layerStates(120, 0, 0, 0);
    const rows = buildVerdictTable(UK_AMATEUR_BANDS, 3360, layers, contextAt(120, 0));
    renderTable(rows);

    expect(screen.getByLabelText('Band by band verdict, ranked best-first')).toBeInTheDocument();
    // Never a bare boolean -- every rendered mode cell shows a margin and a percentage.
    expect(screen.getAllByText(/dB/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/%/).length).toBeGreaterThan(0);
  });

  it('renders unreachable rows distinctly rather than a verdict cell', () => {
    const layers = layerStates(120, 0, 0, 0);
    const rows = buildVerdictTable(UK_AMATEUR_BANDS, 21000, layers, contextAt(120, 0));
    renderTable(rows);

    expect(screen.getAllByText(/No hop geometry reaches this target/).length).toBeGreaterThan(0);
  });

  it('renders an ExplainThisLink per row', () => {
    const layers = layerStates(120, 0, 0, 0);
    const rows = buildVerdictTable(UK_AMATEUR_BANDS, 3360, layers, contextAt(120, 0));
    renderTable(rows);

    expect(screen.getAllByText('Explain this').length).toBe(rows.length);
  });
});
