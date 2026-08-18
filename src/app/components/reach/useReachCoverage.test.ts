/**
 * Reuses phase 4's own "one fine result standing" test pattern
 * (`coverageGridClient.test.ts`): a fake `WorkerLike` wired straight into
 * `coverageWorkerHandler.ts`'s real message-handling logic, so this test
 * exercises the ACTUAL coarse-then-fine two-pass and cancellation
 * contract, not a mock of it.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
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

    const dragPositions = Array.from({ length: 6 }, (_, i) => ({
      lat: DEFAULT_STATION.qth.lat + i * 0.01,
      lon: DEFAULT_STATION.qth.lon,
    }));

    act(() => {
      for (const position of dragPositions) result.current.recompute(position);
    });

    await waitFor(() => expect(result.current.pass).toBe('fine'));

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
});
