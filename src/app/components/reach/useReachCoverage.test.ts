/**
 * Reuses phase 4's own "one fine result standing" test pattern
 * (`coverageGridClient.test.ts`): a fake `WorkerLike` wired straight into
 * `coverageWorkerHandler.ts`'s real message-handling logic, so this test
 * exercises the ACTUAL coarse-then-fine two-pass and cancellation
 * contract, not a mock of it.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import type { Conditions } from '@core/domain/conditions/types';
import { computeCoverageGrid } from '@core/domain/propagation/coverageGrid';
import { CoverageGridClient, type WorkerLike } from '@integrations/propagation/coverageGridClient';
import { createCoverageWorkerHandler } from '@integrations/propagation/coverageWorkerHandler';
import type {
  CoverageGridWorkerMessage,
  CoverageGridWorkerResponse,
} from '@integrations/propagation/protocol';
import { buildCoverageGridInput } from './buildCoverageGridInput.ts';
import { useReachCoverage } from './useReachCoverage.ts';

class FakeCoverageWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<CoverageGridWorkerResponse>) => void) | null = null;
  private readonly handle = createCoverageWorkerHandler((response) => {
    queueMicrotask(() => {
      this.onmessage?.({ data: response } as MessageEvent<CoverageGridWorkerResponse>);
    });
  });

  postMessage(message: CoverageGridWorkerMessage): void {
    queueMicrotask(() => this.handle(message));
  }

  terminate(): void {
    // no real thread to stop
  }
}

function fakeClientFactory(): CoverageGridClient {
  return new CoverageGridClient(() => new FakeCoverageWorker());
}

describe('useReachCoverage', () => {
  it('resolves a fine-pass result after the coarse pass, for the initial mount', async () => {
    const { result } = renderHook(() =>
      useReachCoverage(DEFAULT_STATION, DEFAULT_CONDITIONS, 14.2, fakeClientFactory),
    );

    await waitFor(() => expect(result.current.pass).toBe('fine'));
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.reliability.length).toBeGreaterThan(0);
  });

  it('a simulated rapid marker-drag sequence leaves exactly one fine-pass render as the final state', async () => {
    const { result } = renderHook(() =>
      useReachCoverage(DEFAULT_STATION, DEFAULT_CONDITIONS, 14.2, fakeClientFactory),
    );

    // Let the initial mount's own recompute settle first.
    await waitFor(() => expect(result.current.pass).toBe('fine'));
    const preDragResult = result.current.result;

    const dragPositions = Array.from({ length: 6 }, (_, i) => ({
      lat: DEFAULT_STATION.qth.lat + i * 0.01,
      lon: DEFAULT_STATION.qth.lon,
    }));

    act(() => {
      for (const position of dragPositions) result.current.recompute(position);
    });

    // `pass` is ALREADY 'fine' from the pre-drag settle above, so a bare
    // `waitFor(() => pass === 'fine')` can resolve instantly on stale data
    // if it's checked before any of the drag storm's queued responses have
    // actually been delivered -- also require the result object to have
    // genuinely changed, so this only resolves once a *new* fine result
    // (not the pre-drag one) has actually landed.
    await waitFor(() => {
      expect(result.current.pass).toBe('fine');
      expect(result.current.result).not.toBe(preDragResult);
    });

    // The final rendered result must be the LAST drag position's fine
    // pass -- not an earlier, superseded one. Compare against a direct,
    // synchronous full-resolution sweep at that same position (the pure
    // engine function, no Worker/client involved) as the expected value.
    const lastPosition = dragPositions[dragPositions.length - 1];
    const expected = computeCoverageGrid(
      buildCoverageGridInput(DEFAULT_STATION, DEFAULT_CONDITIONS, 14.2, lastPosition),
    );
    expect(Array.from(result.current.result?.reliability ?? [])).toEqual(
      Array.from(expected.reliability),
    );
    expect(Array.from(result.current.result?.hopCount ?? [])).toEqual(
      Array.from(expected.hopCount),
    );
  });

  it('recomputes when Conditions/frequency change, even without a drag', async () => {
    const { result, rerender } = renderHook(
      ({ frequencyMhz }: { frequencyMhz: number }) =>
        useReachCoverage(DEFAULT_STATION, DEFAULT_CONDITIONS, frequencyMhz, fakeClientFactory),
      { initialProps: { frequencyMhz: 14.2 } },
    );

    await waitFor(() => expect(result.current.pass).toBe('fine'));
    const firstResult = result.current.result;

    rerender({ frequencyMhz: 7.1 });

    await waitFor(() => expect(result.current.result).not.toBe(firstResult));
    await waitFor(() => expect(result.current.pass).toBe('fine'));
  });

  // Regression coverage for the OOM/sluggishness bug: `useConditions` ticks
  // `Conditions.atMs` forward every ~1s while `liveNow` is true, forever.
  // Before the fix, the auto-recompute effect depended directly on
  // `recompute` (which depends on `conditions`), so every one of those
  // ticks re-fired a full coarse+fine coverage-grid sweep.
  describe('auto-recompute cadence (Conditions.atMs live-clock throttling)', () => {
    it('does NOT fire a new sweep on successive small (sub-60s) atMs ticks', async () => {
      const computeSpy = vi.spyOn(CoverageGridClient.prototype, 'compute');
      const { rerender } = renderHook(
        ({ conditions }: { conditions: Conditions }) =>
          useReachCoverage(DEFAULT_STATION, conditions, 14.2, fakeClientFactory),
        { initialProps: { conditions: DEFAULT_CONDITIONS } },
      );

      await waitFor(() => expect(computeSpy).toHaveBeenCalledTimes(1)); // initial mount

      // Simulate useConditions' own 1s ticks -- none individually cross the
      // 60s throttle threshold used by useThrottledConditions.
      for (let i = 1; i <= 30; i++) {
        rerender({
          conditions: { ...DEFAULT_CONDITIONS, atMs: DEFAULT_CONDITIONS.atMs + i * 1000 },
        });
      }
      // Flush any microtasks a (buggy, re-triggering) recompute would need.
      await act(async () => {
        await Promise.resolve();
      });

      expect(computeSpy).toHaveBeenCalledTimes(1);
      computeSpy.mockRestore();
    });

    it('DOES fire a new sweep once atMs has moved by >= 60s since the last auto-recompute', async () => {
      const computeSpy = vi.spyOn(CoverageGridClient.prototype, 'compute');
      const { rerender } = renderHook(
        ({ conditions }: { conditions: Conditions }) =>
          useReachCoverage(DEFAULT_STATION, conditions, 14.2, fakeClientFactory),
        { initialProps: { conditions: DEFAULT_CONDITIONS } },
      );
      await waitFor(() => expect(computeSpy).toHaveBeenCalledTimes(1));

      rerender({ conditions: { ...DEFAULT_CONDITIONS, atMs: DEFAULT_CONDITIONS.atMs + 60_000 } });

      await waitFor(() => expect(computeSpy).toHaveBeenCalledTimes(2));
      computeSpy.mockRestore();
    });

    it('recomputes promptly on a non-time Conditions field change (e.g. SFI/Kp edited in the chrome bar), even if atMs barely moved', async () => {
      const computeSpy = vi.spyOn(CoverageGridClient.prototype, 'compute');
      const { rerender } = renderHook(
        ({ conditions }: { conditions: Conditions }) =>
          useReachCoverage(DEFAULT_STATION, conditions, 14.2, fakeClientFactory),
        { initialProps: { conditions: DEFAULT_CONDITIONS } },
      );
      await waitFor(() => expect(computeSpy).toHaveBeenCalledTimes(1));

      rerender({
        conditions: {
          ...DEFAULT_CONDITIONS,
          atMs: DEFAULT_CONDITIONS.atMs + 1000, // well under the 60s threshold on its own
          driver: { kind: 'manual', sfi: 200, kp: 6 },
        },
      });

      await waitFor(() => expect(computeSpy).toHaveBeenCalledTimes(2));
      computeSpy.mockRestore();
    });

    it('the manual recompute(qthOverride) call (live-drag path) stays fully unthrottled, independent of the auto effect', async () => {
      const computeSpy = vi.spyOn(CoverageGridClient.prototype, 'compute');
      const { result } = renderHook(() =>
        useReachCoverage(DEFAULT_STATION, DEFAULT_CONDITIONS, 14.2, fakeClientFactory),
      );
      await waitFor(() => expect(result.current.pass).toBe('fine'));
      const callsAfterMount = computeSpy.mock.calls.length;

      act(() => {
        result.current.recompute({
          lat: DEFAULT_STATION.qth.lat + 0.01,
          lon: DEFAULT_STATION.qth.lon,
        });
        result.current.recompute({
          lat: DEFAULT_STATION.qth.lat + 0.02,
          lon: DEFAULT_STATION.qth.lon,
        });
        result.current.recompute({
          lat: DEFAULT_STATION.qth.lat + 0.03,
          lon: DEFAULT_STATION.qth.lon,
        });
      });

      // Every direct recompute() call fires its own compute() -- no
      // throttling applied to the manual/live-drag path.
      expect(computeSpy.mock.calls.length).toBe(callsAfterMount + 3);
      computeSpy.mockRestore();
    });
  });
});
