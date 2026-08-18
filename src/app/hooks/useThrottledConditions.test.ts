import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import type { Conditions } from '@core/domain/conditions/types';
import { useThrottledConditions } from './useThrottledConditions.ts';

describe('useThrottledConditions', () => {
  it('returns the initial Conditions object unchanged on first render', () => {
    const { result } = renderHook(() => useThrottledConditions(DEFAULT_CONDITIONS, 60_000));
    expect(result.current).toBe(DEFAULT_CONDITIONS);
  });

  it('does NOT adopt a new atMs that has moved less than the threshold', () => {
    const start: Conditions = { ...DEFAULT_CONDITIONS, atMs: 1_000_000 };
    const { result, rerender } = renderHook(
      ({ conditions }) => useThrottledConditions(conditions, 60_000),
      {
        initialProps: { conditions: start },
      },
    );
    expect(result.current).toBe(start);

    // Simulate a handful of useConditions' own 1s ticks -- none individually
    // cross the 60s threshold.
    for (let i = 1; i <= 30; i++) {
      rerender({ conditions: { ...start, atMs: start.atMs + i * 1000 } });
    }

    expect(result.current).toBe(start);
    expect(result.current.atMs).toBe(1_000_000);
  });

  it('adopts a new atMs once it has moved by at least the threshold', () => {
    const start: Conditions = { ...DEFAULT_CONDITIONS, atMs: 1_000_000 };
    const { result, rerender } = renderHook(
      ({ conditions }) => useThrottledConditions(conditions, 60_000),
      {
        initialProps: { conditions: start },
      },
    );

    const justUnder: Conditions = { ...start, atMs: start.atMs + 59_999 };
    rerender({ conditions: justUnder });
    expect(result.current).toBe(start);

    const atThreshold: Conditions = { ...start, atMs: start.atMs + 60_000 };
    rerender({ conditions: atThreshold });
    expect(result.current).toBe(atThreshold);
  });

  it('adopts a non-atMs field change (driver) immediately, even if atMs barely moved', () => {
    const start: Conditions = { ...DEFAULT_CONDITIONS, atMs: 1_000_000 };
    const { result, rerender } = renderHook(
      ({ conditions }) => useThrottledConditions(conditions, 60_000),
      {
        initialProps: { conditions: start },
      },
    );

    const driverChanged: Conditions = {
      ...start,
      atMs: start.atMs + 1000, // well under the threshold on its own
      driver: { kind: 'manual', sfi: 200, kp: 5 },
    };
    rerender({ conditions: driverChanged });
    expect(result.current).toBe(driverChanged);
  });

  it('adopts a liveNow flip (e.g. scrubTo/goLive) immediately', () => {
    const start: Conditions = { ...DEFAULT_CONDITIONS, atMs: 1_000_000, liveNow: true };
    const { result, rerender } = renderHook(
      ({ conditions }) => useThrottledConditions(conditions, 60_000),
      {
        initialProps: { conditions: start },
      },
    );

    const scrubbed: Conditions = { ...start, atMs: start.atMs - 3600_000, liveNow: false };
    rerender({ conditions: scrubbed });
    expect(result.current).toBe(scrubbed);
  });

  it('adopts a ground change immediately', () => {
    const start: Conditions = { ...DEFAULT_CONDITIONS, atMs: 1_000_000, ground: 'land' };
    const { result, rerender } = renderHook(
      ({ conditions }) => useThrottledConditions(conditions, 60_000),
      {
        initialProps: { conditions: start },
      },
    );

    const groundChanged: Conditions = { ...start, atMs: start.atMs + 1, ground: 'sea' };
    rerender({ conditions: groundChanged });
    expect(result.current).toBe(groundChanged);
  });

  // Regression test for a bug only caught via live-browser verification
  // (not by any of the tests above, which all keep `driver`'s reference
  // stable across a shallow spread): `ConditionsBar.tsx`'s
  // `useConditionsDriver.ts` reconstructs a brand-new `driver` object
  // literal on EVERY render, including the once-a-second render
  // `Conditions.atMs` ticking causes -- so in the real app,
  // `conditions.driver` never has a stable reference, tick or not. A
  // reference-equality check on `driver` would treat every 1s tick as a
  // "meaningful" change and never throttle anything.
  it('does NOT treat a same-VALUE-but-different-REFERENCE driver as a meaningful change', () => {
    const start: Conditions = {
      ...DEFAULT_CONDITIONS,
      atMs: 1_000_000,
      driver: { kind: 'live', sfi: 120, kp: 2, fetchedAtMs: 500_000 },
    };
    const { result, rerender } = renderHook(
      ({ conditions }) => useThrottledConditions(conditions, 60_000),
      { initialProps: { conditions: start } },
    );
    expect(result.current).toBe(start);

    // Simulate 30 ticks: a brand-new `driver` object every render (as
    // `useConditionsDriver` produces in the real app), but with the exact
    // same field values -- nothing has actually changed.
    for (let i = 1; i <= 30; i++) {
      rerender({
        conditions: {
          ...start,
          atMs: start.atMs + i * 1000,
          driver: { kind: 'live', sfi: 120, kp: 2, fetchedAtMs: 500_000 },
        },
      });
    }

    expect(result.current).toBe(start);
    expect(result.current.atMs).toBe(1_000_000);
  });

  it('DOES adopt a driver change when a primitive field actually differs, even with a fresh object each render', () => {
    const start: Conditions = {
      ...DEFAULT_CONDITIONS,
      atMs: 1_000_000,
      driver: { kind: 'live', sfi: 120, kp: 2, fetchedAtMs: 500_000 },
    };
    const { result, rerender } = renderHook(
      ({ conditions }) => useThrottledConditions(conditions, 60_000),
      { initialProps: { conditions: start } },
    );

    const kpChanged: Conditions = {
      ...start,
      atMs: start.atMs + 1000,
      driver: { kind: 'live', sfi: 120, kp: 3, fetchedAtMs: 500_000 },
    };
    rerender({ conditions: kpChanged });
    expect(result.current).toBe(kpChanged);
  });
});
