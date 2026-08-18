import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import TimeScrubber from './TimeScrubber.tsx';

const FIXED_NOW = Date.parse('2026-08-17T12:00:00.000Z');

function renderScrubber(props: Partial<Parameters<typeof TimeScrubber>[0]> = {}) {
  const onScrub = vi.fn();
  const onGoLive = vi.fn();
  render(
    <DesignSystemV2Provider>
      <TimeScrubber atMs={FIXED_NOW} liveNow onScrub={onScrub} onGoLive={onGoLive} {...props} />
    </DesignSystemV2Provider>,
  );
  return { onScrub, onGoLive };
}

describe('TimeScrubber', () => {
  it('renders a slider and an exact-time fallback field', () => {
    renderScrubber();
    expect(screen.getByRole('slider', { name: 'Scrub time' })).toBeInTheDocument();
    expect(screen.getByLabelText('Exact time')).toBeInTheDocument();
  });

  it('shows the live-now toggle checked when liveNow is true', () => {
    renderScrubber({ liveNow: true });
    expect(screen.getByLabelText('Live now')).toBeChecked();
  });

  it('calls onGoLive when the live-now toggle is switched back on', () => {
    const { onGoLive } = renderScrubber({ liveNow: false });
    fireEvent.click(screen.getByLabelText('Live now'));
    expect(onGoLive).toHaveBeenCalled();
  });

  it('calls onScrub with a parsed timestamp when the exact-time field changes', () => {
    const { onScrub } = renderScrubber({ liveNow: false });
    const input = screen.getByLabelText('Exact time');
    fireEvent.change(input, { target: { value: '2026-08-18T09:30' } });
    expect(onScrub).toHaveBeenCalled();
    const calledWith = onScrub.mock.calls[0][0] as number;
    expect(new Date(calledWith).getHours()).toBe(9);
    expect(new Date(calledWith).getMinutes()).toBe(30);
  });
});
