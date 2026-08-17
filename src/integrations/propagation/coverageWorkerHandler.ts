/**
 * The coverage-grid Worker's actual message-handling logic (F2.14/F2.15),
 * as a plain function -- deliberately separate from `coverageWorker.ts`
 * (the real `self.onmessage` entry point) so it can be unit-tested directly
 * with a fake `post` callback, without needing an actual Worker thread
 * (jsdom, this project's vitest environment, doesn't implement Web
 * Workers).
 *
 * Coarse-then-fine two-pass (Slice 5, F2.15): each `computeCoverage`
 * request runs `computeCoverageGridAtStride` at quarter resolution first
 * (halving both azimuth and elevation sample density, per the phase plan --
 * "halve each dimension, which quarters the total work"), posts that as
 * `{pass: 'coarse'}`, then continues to the full-resolution sweep and posts
 * `{pass: 'fine'}` for the SAME requestId.
 *
 * Cancellation: a `Set<number>` of cancelled request ids, checked once per
 * traced azimuth row inside the sweep (`computeCoverageGridAtStride`'s
 * `shouldCancel` callback) -- not every hop iteration (wasteful) and not
 * only at the end (too coarse to actually save work), per the phase plan.
 */

import {
  computeCoverageGridAtStride,
  COVERAGE_AZIMUTH_COUNT,
  COVERAGE_ELEVATION_COUNT,
} from '@core/domain/propagation/coverageGrid';
import type { CoverageGridWorkerMessage, CoverageGridWorkerResponse } from './protocol';

/** Halving each dimension quarters the total sweep work -- see the phase plan's Slice 5. */
const COARSE_STRIDE = 2;
const FINE_STRIDE = 1;

export type PostResponse = (
  response: CoverageGridWorkerResponse,
  transfer?: Transferable[],
) => void;

function transferListFor(result: {
  reliability: Float32Array;
  snrDb: Float32Array;
  hopCount: Uint8Array;
}): Transferable[] {
  return [result.reliability.buffer, result.snrDb.buffer, result.hopCount.buffer];
}

/**
 * Builds the worker's message handler, closing over its own cancellation
 * set. Exported (rather than module-level state) so tests can construct
 * independent handler instances without cross-test interference.
 */
export function createCoverageWorkerHandler(
  post: PostResponse,
): (message: CoverageGridWorkerMessage) => void {
  const cancelledRequestIds = new Set<number>();

  return function handleMessage(message: CoverageGridWorkerMessage): void {
    if (message.type === 'cancel') {
      cancelledRequestIds.add(message.requestId);
      return;
    }

    const { requestId, payload } = message;
    const shouldCancel = () => cancelledRequestIds.has(requestId);

    try {
      const coarse = computeCoverageGridAtStride(
        payload,
        COARSE_STRIDE,
        COARSE_STRIDE,
        shouldCancel,
      );
      if (coarse.kind === 'cancelled') {
        cancelledRequestIds.delete(requestId);
        post({ type: 'cancelled', requestId });
        return;
      }
      post(
        { type: 'result', requestId, pass: 'coarse', result: coarse.result },
        transferListFor(coarse.result),
      );

      const fine = computeCoverageGridAtStride(payload, FINE_STRIDE, FINE_STRIDE, shouldCancel);
      if (fine.kind === 'cancelled') {
        cancelledRequestIds.delete(requestId);
        post({ type: 'cancelled', requestId });
        return;
      }
      post(
        { type: 'result', requestId, pass: 'fine', result: fine.result },
        transferListFor(fine.result),
      );
      cancelledRequestIds.delete(requestId);
    } catch (err) {
      cancelledRequestIds.delete(requestId);
      post({ type: 'error', requestId, message: err instanceof Error ? err.message : String(err) });
    }
  };
}

// Re-exported for tests that want to assert the coarse pass really is a
// quarter of the full sweep's azimuth x elevation sample count.
export const COARSE_AZIMUTH_SAMPLE_COUNT = Math.ceil(COVERAGE_AZIMUTH_COUNT / COARSE_STRIDE);
export const COARSE_ELEVATION_SAMPLE_COUNT = Math.ceil(COVERAGE_ELEVATION_COUNT / COARSE_STRIDE);
