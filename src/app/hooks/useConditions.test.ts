import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConditions } from './useConditions.ts';

describe('useConditions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks atMs forward roughly once a second while liveNow is true', () => {
    const start = Date.parse('2026-08-17T12:00:00.000Z');
    vi.setSystemTime(start);
    const { result } = renderHook(() => useConditions({ atMs: start, liveNow: true }));

    expect(result.current.atMs).toBe(start);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.atMs).toBe(start + 1000);
    expect(result.current.liveNow).toBe(true);
  });

  it('stops advancing once liveNow is set to false via scrubTo', () => {
    const start = Date.parse('2026-08-17T12:00:00.000Z');
    vi.setSystemTime(start);
    const { result } = renderHook(() => useConditions({ atMs: start, liveNow: true }));

    const scrubbedTo = start - 3600_000;
    act(() => {
      result.current.scrubTo(scrubbedTo);
    });

    expect(result.current.atMs).toBe(scrubbedTo);
    expect(result.current.liveNow).toBe(false);

    // Even if a lot of "wall clock" time passes, a non-live atMs must not
    // silently drift.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.atMs).toBe(scrubbedTo);
  });

  it('resumes live tracking from now via goLive', () => {
    const start = Date.parse('2026-08-17T12:00:00.000Z');
    vi.setSystemTime(start);
    const { result } = renderHook(() => useConditions({ atMs: start - 7200_000, liveNow: false }));

    expect(result.current.liveNow).toBe(false);

    act(() => {
      result.current.goLive();
    });

    expect(result.current.liveNow).toBe(true);
    expect(result.current.atMs).toBe(start);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.atMs).toBe(start + 1000);
  });
});
