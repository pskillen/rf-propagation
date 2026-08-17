/**
 * Slice 4/5 correctness tests (F2.14/F2.15, phase 4 plan): the client side
 * of the coverage-grid Worker protocol, driven against a FAKE worker (jsdom
 * has no real Worker implementation) that wires straight into
 * coverageWorkerHandler.ts's real message-handling logic, with responses
 * delivered via a microtask (a closer approximation of a real Worker's
 * inherently-async postMessage than a synchronous fake would be).
 */
import { describe, expect, it } from 'vitest';
import { layerStates } from '@core/domain/propagation/layers';
import { ssnFromSfi } from '@core/domain/propagation/losses';
import {
  computeCoverageGridAtStride,
  type CoverageGridInput,
  type CoverageGridResult,
} from '@core/domain/propagation/coverageGrid';
import { CoverageGridClient, type WorkerLike } from './coverageGridClient';
import { createCoverageWorkerHandler } from './coverageWorkerHandler';
import type { CoverageGridWorkerMessage, CoverageGridWorkerResponse } from './protocol';

const EQUINOX_SOLAR_NOON_UTC = Date.UTC(2024, 2, 20, 12, 0, 0);

const SAMPLE_PAYLOAD: CoverageGridInput = {
  txLat: 0,
  txLon: 0,
  atMs: EQUINOX_SOLAR_NOON_UTC,
  frequencyMhz: 14,
  layers: layerStates(120, 0, 0, 0),
  ssn: ssnFromSfi(120),
  txPowerW: 100,
  txAntennaGainDbi: 6,
  rxAntennaGainDbi: 6,
  groundType: 'land',
  noiseEnvironment: 'rural',
  bandwidthHz: 2400,
};

/** Fake WorkerLike wired to the real handler, responses delivered via a microtask. */
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

function makeClient(): CoverageGridClient {
  return new CoverageGridClient(() => new FakeCoverageWorker());
}

describe('CoverageGridClient -- happy path', () => {
  it('resolves with the fine-pass result, calling onCoarse first', async () => {
    const client = makeClient();
    const coarseResults: CoverageGridResult[] = [];

    const result = await client.compute(SAMPLE_PAYLOAD, (coarse) => coarseResults.push(coarse));

    expect(coarseResults).toHaveLength(1);
    expect(result.azimuthCount).toBe(coarseResults[0].azimuthCount);
    expect(result.reliability.length).toBeGreaterThan(0);
  });
});

describe('CoverageGridClient -- cancellation (F2.15)', () => {
  it('cancelling an in-flight request (by starting a new one) rejects its promise', async () => {
    const client = makeClient();

    const first = client.compute(SAMPLE_PAYLOAD);
    const second = client.compute(SAMPLE_PAYLOAD);

    await expect(first).rejects.toThrow();
    await expect(second).resolves.toBeDefined();
  });

  it('rapid successive requests (the shape of a slider drag) leave exactly one fine result standing', async () => {
    const client = makeClient();

    const promises = Array.from({ length: 6 }, (_, i) =>
      client.compute({ ...SAMPLE_PAYLOAD, frequencyMhz: 14 + i }),
    );

    const settled = await Promise.allSettled(promises);

    const fulfilled = settled.filter((s) => s.status === 'fulfilled');
    const rejected = settled.filter((s) => s.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(5);
    // The one that survived is the LAST request issued.
    expect(settled[5].status).toBe('fulfilled');
  });

  it('destroy() rejects any still-pending request', async () => {
    const client = makeClient();
    const pending = client.compute(SAMPLE_PAYLOAD);
    client.destroy();
    await expect(pending).rejects.toThrow();
  });
});

describe('coarse-pass latency budget (Slice 4/F2.14)', () => {
  it('the coarse-resolution sweep completes within the ~150ms NFR budget', () => {
    // physics-and-fidelity.md doesn't give a coarse-pass-specific number;
    // product-requirements.md's NFR targets ~150ms for the full coarse
    // recompute on a mid-tier laptop -- used here as the benchmark
    // threshold, per the phase plan's own instruction to source it from
    // the NFR rather than inventing a number.
    const start = performance.now();
    const swept = computeCoverageGridAtStride(SAMPLE_PAYLOAD, 2, 2);
    const elapsedMs = performance.now() - start;

    expect(swept.kind).toBe('completed');
    expect(elapsedMs).toBeLessThan(150);
  });
});
