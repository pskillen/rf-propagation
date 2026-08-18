import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
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
});
