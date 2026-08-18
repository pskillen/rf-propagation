import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import type { Conditions } from '@core/domain/conditions/types';
import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import { CoverageGridClient, type WorkerLike } from '@integrations/propagation/coverageGridClient';
import { createCoverageWorkerHandler } from '@integrations/propagation/coverageWorkerHandler';
import type {
  CoverageGridWorkerMessage,
  CoverageGridWorkerResponse,
} from '@integrations/propagation/protocol';
import { useBestBandNow } from './useBestBandNow.ts';

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

describe('useBestBandNow', () => {
  it('eventually ranks every amateur band, best (highest mean reliability) first', async () => {
    const { result } = renderHook(() =>
      useBestBandNow(DEFAULT_STATION, DEFAULT_CONDITIONS, fakeClientFactory),
    );

    await waitFor(
      () => {
        expect(result.current).toHaveLength(UK_AMATEUR_BANDS.length);
      },
      { timeout: 10_000 },
    );

    // Descending by meanReliability.
    for (let i = 1; i < result.current.length; i++) {
      expect(result.current[i - 1].meanReliability).toBeGreaterThanOrEqual(
        result.current[i].meanReliability,
      );
    }
    // Every catalogue band id appears exactly once.
    expect(new Set(result.current.map((r) => r.bandId))).toEqual(
      new Set(UK_AMATEUR_BANDS.map((b) => b.id)),
    );
  }, 15_000);

  // Regression coverage for the OOM/sluggishness bug: this hook runs a
  // FULL per-band sweep (UK_AMATEUR_BANDS.length sequential coarse+fine
  // coverage-grid computes) every time its effect fires. Before the fix,
  // that effect depended directly on `conditions`, which changes identity
  // every ~1s while `Conditions.liveNow` is true -- turning every live
  // clock tick into 9x the per-tick cost `useReachCoverage` has.
  describe('auto-recompute cadence (Conditions.atMs live-clock throttling)', () => {
    it('does NOT re-run the per-band sweep on successive small (sub-60s) atMs ticks', async () => {
      const computeSpy = vi.spyOn(CoverageGridClient.prototype, 'compute');
      const { result, rerender } = renderHook(
        ({ conditions }: { conditions: Conditions }) =>
          useBestBandNow(DEFAULT_STATION, conditions, fakeClientFactory),
        { initialProps: { conditions: DEFAULT_CONDITIONS } },
      );

      await waitFor(() => expect(result.current).toHaveLength(UK_AMATEUR_BANDS.length), {
        timeout: 10_000,
      });
      const callsAfterInitialSweep = computeSpy.mock.calls.length;
      expect(callsAfterInitialSweep).toBe(UK_AMATEUR_BANDS.length);

      for (let i = 1; i <= 30; i++) {
        rerender({
          conditions: { ...DEFAULT_CONDITIONS, atMs: DEFAULT_CONDITIONS.atMs + i * 1000 },
        });
      }
      await act(async () => {
        await Promise.resolve();
      });

      expect(computeSpy.mock.calls.length).toBe(callsAfterInitialSweep);
      computeSpy.mockRestore();
    }, 15_000);

    it('DOES re-run the per-band sweep once atMs has moved by >= 60s', async () => {
      const computeSpy = vi.spyOn(CoverageGridClient.prototype, 'compute');
      const { result, rerender } = renderHook(
        ({ conditions }: { conditions: Conditions }) =>
          useBestBandNow(DEFAULT_STATION, conditions, fakeClientFactory),
        { initialProps: { conditions: DEFAULT_CONDITIONS } },
      );
      await waitFor(() => expect(result.current).toHaveLength(UK_AMATEUR_BANDS.length), {
        timeout: 10_000,
      });
      const callsAfterInitialSweep = computeSpy.mock.calls.length;

      rerender({ conditions: { ...DEFAULT_CONDITIONS, atMs: DEFAULT_CONDITIONS.atMs + 60_000 } });

      await waitFor(
        () =>
          expect(computeSpy.mock.calls.length).toBe(
            callsAfterInitialSweep + UK_AMATEUR_BANDS.length,
          ),
        { timeout: 10_000 },
      );
      computeSpy.mockRestore();
    }, 15_000);
  });
});
