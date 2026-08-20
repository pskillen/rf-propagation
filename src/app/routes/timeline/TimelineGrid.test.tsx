import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import type { TimelineCell } from '@core/domain/propagation/timelineGrid';
import TimelineGrid from './TimelineGrid.tsx';

function buildCells(
  reliabilityForHour: (bandId: string, hourUtc: number) => number,
): TimelineCell[] {
  const cells: TimelineCell[] = [];
  for (const band of UK_AMATEUR_BANDS) {
    for (let hourUtc = 0; hourUtc < 24; hourUtc++) {
      const reliability = reliabilityForHour(band.id, hourUtc);
      const bucket = reliability >= 0.7 ? 'good' : reliability >= 0.3 ? 'marginal' : 'unlikely';
      cells.push({
        bandId: band.id,
        frequencyMhz: (band.minMhz + band.maxMhz) / 2,
        hourUtc,
        hopSolve: { kind: 'unreachable' },
        reliability,
        bucket,
      });
    }
  }
  return cells;
}

describe('TimelineGrid', () => {
  it('renders one button per cell (10 bands x 24 hours)', () => {
    const cells = buildCells(() => 0.5);
    render(<TimelineGrid cells={cells} currentHourUtc={12} onSelectHour={() => {}} />);

    expect(screen.getByLabelText('24-hour band-by-band reliability grid')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(UK_AMATEUR_BANDS.length * 24);
  });

  it('colours cells differently across a mixed-reliability scenario', () => {
    const cells = buildCells((_bandId, hourUtc) => (hourUtc < 12 ? 0.9 : 0.1));
    render(<TimelineGrid cells={cells} currentHourUtc={0} onSelectHour={() => {}} />);

    const goodCell = screen.getByLabelText(/160 m at 00z — good/);
    const unlikelyCell = screen.getByLabelText(/160 m at 12z — unlikely/);
    expect(goodCell.className).not.toBe(unlikelyCell.className);
  });

  it('marks the current-time column distinctly from an unrelated selection', () => {
    const cells = buildCells(() => 0.5);
    render(
      <TimelineGrid cells={cells} currentHourUtc={9} selectedHourUtc={3} onSelectHour={() => {}} />,
    );

    const currentCell = screen.getByLabelText(/160 m at 09z/);
    const selectedCell = screen.getByLabelText(/160 m at 03z/);
    const otherCell = screen.getByLabelText(/160 m at 15z/);
    expect(currentCell.className).not.toBe(otherCell.className);
    expect(selectedCell.className).not.toBe(otherCell.className);
    expect(currentCell.className).not.toBe(selectedCell.className);
  });

  it('fires onSelectHour with the clicked cell hour when clicked', () => {
    const cells = buildCells(() => 0.5);
    const onSelectHour = vi.fn();
    render(<TimelineGrid cells={cells} currentHourUtc={0} onSelectHour={onSelectHour} />);

    fireEvent.click(screen.getByLabelText(/40 m at 15z/));
    expect(onSelectHour).toHaveBeenCalledWith(15);
  });
});
