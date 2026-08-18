import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ViewerStateProvider, useViewerState } from '../../state/viewerState.tsx';
import ExplainThisLink from './ExplainThisLink.tsx';

function StateProbe() {
  const { state } = useViewerState();
  return (
    <pre data-testid="state">
      {JSON.stringify({ surface: state.surface, target: state.target, bandId: state.bandId })}
    </pre>
  );
}

function readState(): { surface: string; target: unknown; bandId: string } {
  return JSON.parse(screen.getByTestId('state').textContent ?? '{}');
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('ExplainThisLink', () => {
  it('switches surface to explore and applies target/bandId overrides on click', () => {
    render(
      <MemoryRouter>
        <ViewerStateProvider>
          <ExplainThisLink target={{ lat: 10, lon: 20, source: 'map-click' }} bandId="20m" />
          <StateProbe />
        </ViewerStateProvider>
      </MemoryRouter>,
    );

    expect(readState().surface).toBe('reach');

    fireEvent.click(screen.getByText('Explain this'));

    const after = readState();
    expect(after.surface).toBe('explore');
    expect(after.bandId).toBe('20m');
    expect(after.target).toEqual({ lat: 10, lon: 20, source: 'map-click' });
  });

  it('renders a custom label when given', () => {
    render(
      <MemoryRouter>
        <ViewerStateProvider>
          <ExplainThisLink label="Why is this marginal?" />
        </ViewerStateProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Why is this marginal?')).toBeInTheDocument();
  });
});
