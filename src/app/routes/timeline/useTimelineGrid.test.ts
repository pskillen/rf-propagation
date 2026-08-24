import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import { DEFAULT_TIMELINE_STATE } from '../../state/timeline.ts';
import type { Target } from '../../state/viewerState.tsx';
import { useTimelineGrid } from './useTimelineGrid.ts';

describe('useTimelineGrid', () => {
  it('produces the full 10-band x 24-hour grid using the reference distance/bearing when target is null', () => {
    const { result } = renderHook(() =>
      useTimelineGrid(DEFAULT_STATION, DEFAULT_CONDITIONS, null, DEFAULT_TIMELINE_STATE),
    );
    expect(result.current).toHaveLength(UK_AMATEUR_BANDS.length * 24);
    expect(new Set(result.current.map((cell) => cell.bandId))).toEqual(
      new Set(UK_AMATEUR_BANDS.map((band) => band.id)),
    );
  });

  it('uses the great-circle distance/bearing to the target instead, once one is set', () => {
    const target: Target = { lat: 40, lon: -74, source: 'map-click' }; // roughly New York, from a UK station
    const { result: withoutTarget } = renderHook(() =>
      useTimelineGrid(DEFAULT_STATION, DEFAULT_CONDITIONS, null, DEFAULT_TIMELINE_STATE),
    );
    const { result: withTarget } = renderHook(() =>
      useTimelineGrid(DEFAULT_STATION, DEFAULT_CONDITIONS, target, DEFAULT_TIMELINE_STATE),
    );

    // Different geometry (a transatlantic target vs the ~3000km/90deg
    // reference) should not just coincidentally produce an identical grid.
    expect(withTarget.current).not.toEqual(withoutTarget.current);
    expect(withTarget.current).toHaveLength(UK_AMATEUR_BANDS.length * 24);
  });

  it('does not recompute when only the live clock ticks within the same UTC day', () => {
    const conditionsAtStart = { ...DEFAULT_CONDITIONS, atMs: Date.UTC(2026, 5, 21, 9, 0, 0) };
    const { result, rerender } = renderHook(
      ({ conditions }) =>
        useTimelineGrid(DEFAULT_STATION, conditions, null, DEFAULT_TIMELINE_STATE),
      { initialProps: { conditions: conditionsAtStart } },
    );
    const firstGrid = result.current;

    rerender({ conditions: { ...conditionsAtStart, atMs: conditionsAtStart.atMs + 5_000 } });

    expect(result.current).toBe(firstGrid);
  });
});
