import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import { DEFAULT_PLAYBACK, PLAYBACK_SPEED_OPTIONS } from '../../state/playback.ts';
import TransportControl from './TransportControl.tsx';

const FIXED_NOW = Date.parse('2026-08-17T12:00:00.000Z');

function renderControl(props: Partial<Parameters<typeof TransportControl>[0]> = {}) {
  const onAtMsChange = vi.fn();
  const onPlaybackChange = vi.fn();
  render(
    <DesignSystemV2Provider>
      <TransportControl
        atMs={FIXED_NOW}
        playback={DEFAULT_PLAYBACK}
        onAtMsChange={onAtMsChange}
        onPlaybackChange={onPlaybackChange}
        {...props}
      />
    </DesignSystemV2Provider>,
  );
  return { onAtMsChange, onPlaybackChange };
}

describe('TransportControl', () => {
  beforeEach(() => {
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders play, a speed selector for every configured speed, and a scrub slider', () => {
    renderControl();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Scrub time' })).toBeInTheDocument();
    for (const option of PLAYBACK_SPEED_OPTIONS) {
      expect(screen.getByRole('button', { name: option.label })).toBeInTheDocument();
    }
  });

  it('toggles playback.playing on play/pause click', () => {
    const { onPlaybackChange } = renderControl({
      playback: { ...DEFAULT_PLAYBACK, playing: false },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(onPlaybackChange).toHaveBeenCalledWith({ ...DEFAULT_PLAYBACK, playing: true });
  });

  it('shows Pause and calls onPlaybackChange({ playing: false }) when already playing', () => {
    const { onPlaybackChange } = renderControl({
      playback: { ...DEFAULT_PLAYBACK, playing: true },
    });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onPlaybackChange).toHaveBeenCalledWith({ ...DEFAULT_PLAYBACK, playing: false });
  });

  it("selecting a speed calls onPlaybackChange with that speed's hoursPerSecond", () => {
    const { onPlaybackChange } = renderControl();
    fireEvent.click(screen.getByRole('button', { name: '24×' }));
    const fastest = PLAYBACK_SPEED_OPTIONS[PLAYBACK_SPEED_OPTIONS.length - 1];
    expect(onPlaybackChange).toHaveBeenCalledWith({
      ...DEFAULT_PLAYBACK,
      speedMultiplier: fastest.hoursPerSecond,
    });
  });

  it('highlights the segment matching the current playback.speedMultiplier', () => {
    const fastest = PLAYBACK_SPEED_OPTIONS[PLAYBACK_SPEED_OPTIONS.length - 1];
    renderControl({ playback: { ...DEFAULT_PLAYBACK, speedMultiplier: fastest.hoursPerSecond } });
    expect(screen.getByRole('button', { name: '24×' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('advances atMs by frameDeltaMs * speedMultiplier * 3600 while playing, via requestAnimationFrame', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const speed = PLAYBACK_SPEED_OPTIONS[1].hoursPerSecond; // '1×', 0.4 hours/sec
    const { onAtMsChange } = renderControl({
      playback: { ...DEFAULT_PLAYBACK, playing: true, speedMultiplier: speed },
    });

    // First scheduled frame just anchors lastFrameTimeMs -- no atMs change yet.
    expect(rafCallbacks.length).toBe(1);
    rafCallbacks[0](1000);
    expect(onAtMsChange).not.toHaveBeenCalled();

    // Second frame, 16ms of real time later, advances atMs by 16 * speed * 3600.
    rafCallbacks[1](1016);
    expect(onAtMsChange).toHaveBeenCalledTimes(1);
    const expectedDeltaMs = 16 * speed * 3600;
    expect(onAtMsChange).toHaveBeenCalledWith(FIXED_NOW + expectedDeltaMs);

    rafSpy.mockRestore();
  });

  it('does not schedule any animation frame while paused', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    renderControl({ playback: { ...DEFAULT_PLAYBACK, playing: false } });
    expect(rafSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();
  });

  it('cancels the animation frame loop when playback stops', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 42);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const { rerender } = render(
      <DesignSystemV2Provider>
        <TransportControl
          atMs={FIXED_NOW}
          playback={{ ...DEFAULT_PLAYBACK, playing: true }}
          onAtMsChange={vi.fn()}
          onPlaybackChange={vi.fn()}
        />
      </DesignSystemV2Provider>,
    );
    rerender(
      <DesignSystemV2Provider>
        <TransportControl
          atMs={FIXED_NOW}
          playback={{ ...DEFAULT_PLAYBACK, playing: false }}
          onAtMsChange={vi.fn()}
          onPlaybackChange={vi.fn()}
        />
      </DesignSystemV2Provider>,
    );
    expect(cancelSpy).toHaveBeenCalledWith(42);

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
  });

  it('pauses playback when the scrub slider is dragged manually', () => {
    const { onAtMsChange, onPlaybackChange } = renderControl({
      playback: { ...DEFAULT_PLAYBACK, playing: true },
    });
    const slider = screen.getByRole('slider', { name: 'Scrub time' });
    slider.focus();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onPlaybackChange).toHaveBeenCalledWith({ ...DEFAULT_PLAYBACK, playing: false });
    expect(onAtMsChange).toHaveBeenCalled();
  });
});
