import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import ReachSummaryStrip from './ReachSummaryStrip.tsx';

function fixtureResult(): CoverageGridResult {
  return {
    azimuthCount: 1,
    rangeBinCount: 2,
    rangeBinKm: 50,
    reliability: Float32Array.from([0.9, 0.7]),
    snrDb: new Float32Array(2),
    hopCount: Uint8Array.from([0, 1]),
  };
}

describe('ReachSummaryStrip', () => {
  it('shows a placeholder before the coverage grid resolves', () => {
    render(<ReachSummaryStrip coverageResult={null} bandRankings={[]} />);
    expect(screen.getByText(/Computing coverage/)).toBeInTheDocument();
    expect(screen.getByText(/Ranking bands/)).toBeInTheDocument();
  });

  it('shows the current bands reach extremes once a grid resolves', () => {
    render(<ReachSummaryStrip coverageResult={fixtureResult()} bandRankings={[]} />);
    expect(screen.getByText(/groundwave to 50 km/)).toBeInTheDocument();
    expect(screen.getByText(/first hop 50-100 km/)).toBeInTheDocument();
  });

  it('shows the best band with its reliability percentage (FR-9: no bare booleans)', () => {
    render(
      <ReachSummaryStrip
        coverageResult={null}
        bandRankings={[
          { bandId: '20m', meanReliability: 0.82 },
          { bandId: '40m', meanReliability: 0.5 },
        ]}
      />,
    );
    expect(screen.getByText(/20 m/)).toBeInTheDocument();
    expect(screen.getByText(/82% reliability/)).toBeInTheDocument();
  });
});
