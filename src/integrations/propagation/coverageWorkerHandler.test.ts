/**
 * Slice 4/5 correctness tests (F2.14/F2.15, phase 4 plan): the worker's
 * pure message-handling logic, driven directly with a fake `post` callback
 * (jsdom -- this project's vitest environment -- has no real Worker
 * implementation, so this is deliberately NOT a real-Worker-thread test;
 * coverageGridClient.test.ts covers the client side of the same protocol).
 */
import { describe, expect, it } from 'vitest';
import { layerStates } from '@core/domain/propagation/layers';
import { ssnFromSfi } from '@core/domain/propagation/losses';
import type { CoverageGridInput } from '@core/domain/propagation/coverageGrid';
import { createCoverageWorkerHandler } from './coverageWorkerHandler';
import type { CoverageGridWorkerResponse } from './protocol';

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

describe('createCoverageWorkerHandler -- coarse-then-fine two-pass', () => {
  it('posts a coarse result then a fine result for the same requestId', () => {
    const responses: CoverageGridWorkerResponse[] = [];
    const handle = createCoverageWorkerHandler((response) => responses.push(response));

    handle({ type: 'computeCoverage', requestId: 1, payload: SAMPLE_PAYLOAD });

    expect(responses).toHaveLength(2);
    expect(responses[0]).toMatchObject({ type: 'result', requestId: 1, pass: 'coarse' });
    expect(responses[1]).toMatchObject({ type: 'result', requestId: 1, pass: 'fine' });
  });

  it('transfers the result buffers (reliability/snrDb/hopCount) rather than cloning them', () => {
    const transfers: Transferable[][] = [];
    const handle = createCoverageWorkerHandler((_response, transfer) => {
      transfers.push(transfer ?? []);
    });

    handle({ type: 'computeCoverage', requestId: 1, payload: SAMPLE_PAYLOAD });

    expect(transfers).toHaveLength(2);
    for (const transferList of transfers) {
      expect(transferList).toHaveLength(3);
      for (const buffer of transferList) {
        expect(buffer).toBeInstanceOf(ArrayBuffer);
      }
    }
  });

  it('a real postMessage transfer (via MessageChannel) actually detaches the sender-side buffers', async () => {
    // Confirms "transferable", not just "the types are typed arrays" -- per
    // the phase plan's own Slice 4 test instruction. Node's global
    // MessageChannel/MessagePort implement real structured-clone transfer
    // semantics, so posting through one and checking byteLength === 0
    // afterward is a genuine test of the transfer, not a mock of it.
    const { port1, port2 } = new MessageChannel();
    try {
      const received: CoverageGridWorkerResponse[] = [];
      port2.onmessage = (event: MessageEvent<CoverageGridWorkerResponse>) =>
        received.push(event.data);
      port2.start();

      let capturedBuffers: ArrayBuffer[] = [];
      const handle = createCoverageWorkerHandler((response, transfer) => {
        if (transfer) capturedBuffers = transfer as ArrayBuffer[];
        port1.postMessage(response, transfer as Transferable[]);
      });

      handle({ type: 'computeCoverage', requestId: 7, payload: SAMPLE_PAYLOAD });

      // The LAST post's buffers are what we check -- by the time handle()
      // returns synchronously, postMessage has already performed the
      // structured-clone transfer for every call made so far.
      expect(capturedBuffers.length).toBe(3);
      for (const buffer of capturedBuffers) {
        expect(buffer.byteLength).toBe(0);
      }

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(received.length).toBeGreaterThan(0);
    } finally {
      port1.close();
      port2.close();
    }
  });
});

describe('createCoverageWorkerHandler -- cancellation (F2.15)', () => {
  it('a cancel message for a requestId not yet started stops it before any result is posted', () => {
    const responses: CoverageGridWorkerResponse[] = [];
    const handle = createCoverageWorkerHandler((response) => responses.push(response));

    handle({ type: 'cancel', requestId: 1 });
    handle({ type: 'computeCoverage', requestId: 1, payload: SAMPLE_PAYLOAD });

    expect(responses).toHaveLength(1);
    expect(responses[0]).toEqual({ type: 'cancelled', requestId: 1 });
  });

  it('cancelling between the coarse and fine pass stops the fine pass from ever being posted', () => {
    const responses: CoverageGridWorkerResponse[] = [];
    const handler = createCoverageWorkerHandler((response) => {
      responses.push(response);
      if (response.type === 'result' && response.pass === 'coarse') {
        // Cancel from inside the coarse-pass post callback -- guaranteed to
        // land before computeCoverageGridAtStride's fine-pass sweep starts.
        // `handler` is safe to reference here even though this closure was
        // created during its own initialisation: by the time this callback
        // actually RUNS (inside handler(...) below), `handler` is fully
        // assigned.
        handler({ type: 'cancel', requestId: response.requestId });
      }
    });

    handler({ type: 'computeCoverage', requestId: 1, payload: SAMPLE_PAYLOAD });

    expect(responses).toHaveLength(2);
    expect(responses[0]).toMatchObject({ type: 'result', requestId: 1, pass: 'coarse' });
    expect(responses[1]).toEqual({ type: 'cancelled', requestId: 1 });
    // No fine-pass result was ever posted.
    expect(responses.some((r) => r.type === 'result' && r.pass === 'fine')).toBe(false);
  });

  it('an unrelated cancel (different requestId) does not affect an in-flight request', () => {
    const responses: CoverageGridWorkerResponse[] = [];
    const handle = createCoverageWorkerHandler((response) => responses.push(response));

    handle({ type: 'cancel', requestId: 999 });
    handle({ type: 'computeCoverage', requestId: 1, payload: SAMPLE_PAYLOAD });

    expect(responses).toHaveLength(2);
    expect(responses[0]).toMatchObject({ type: 'result', requestId: 1, pass: 'coarse' });
    expect(responses[1]).toMatchObject({ type: 'result', requestId: 1, pass: 'fine' });
  });
});
