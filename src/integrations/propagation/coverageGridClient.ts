/**
 * Typed client for the coverage-grid Worker (F2.14/F2.15) -- ported IN
 * SHAPE from Codeplug Studio's `RayTraceClient` (owns the `Worker`, tracks
 * pending requests in a `Map<number, PendingRequest>` keyed by requestId,
 * resolves/rejects by matching the response's requestId), but NOT ported
 * unmodified: Studio's client has no real cancellation (mk1's
 * `usePropagationRayTrace.ts` just drops stale responses client-side via a
 * `cancelled` flag) and no coarse/fine two-pass. This class adds both.
 *
 * Cancellation model: at most ONE request is tracked as "current" at a
 * time. Calling `compute()` while a previous request is still in flight
 * immediately (synchronously) cancels it -- posts `{type: 'cancel'}` to the
 * worker AND rejects/forgets its pending promise client-side, so a
 * late-arriving stale response for that id is simply ignored (no pending
 * entry left to resolve). This is what gives "rapid successive requests
 * leave exactly one fine result standing" (F2.15's acceptance criterion) --
 * see coverageGridClient.test.ts.
 */

import type { CoverageGridWorkerMessage, CoverageGridWorkerResponse } from './protocol';
import type { CoverageGridInput, CoverageGridResult } from '@core/domain/propagation/coverageGrid';

/**
 * The subset of the real `Worker` API this client needs -- lets tests
 * inject a fake (jsdom has no real Worker implementation) while production
 * code gets an actual `Worker` instance.
 */
export interface WorkerLike {
  postMessage(message: CoverageGridWorkerMessage, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<CoverageGridWorkerResponse>) => void) | null;
  terminate?(): void;
}

interface PendingRequest {
  onCoarse?: (result: CoverageGridResult) => void;
  resolve: (result: CoverageGridResult) => void;
  reject: (reason: unknown) => void;
}

function defaultWorkerFactory(): WorkerLike {
  return new Worker(new URL('./coverageWorker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as WorkerLike;
}

export class CoverageGridClient {
  private readonly worker: WorkerLike;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private currentRequestId: number | null = null;

  constructor(workerFactory: () => WorkerLike = defaultWorkerFactory) {
    this.worker = workerFactory();
    this.worker.onmessage = (event) => this.handleMessage(event.data);
  }

  /**
   * Issues a new coverage-grid computation, cancelling any request still in
   * flight first. `onCoarse` (optional) is called once with the coarse-pass
   * result as soon as it arrives; the returned promise resolves with the
   * fine-pass result, or rejects if this request is cancelled (superseded
   * by a later `compute()` call, or the client is destroyed) or the worker
   * reports an error.
   */
  compute(
    payload: CoverageGridInput,
    onCoarse?: (result: CoverageGridResult) => void,
  ): Promise<CoverageGridResult> {
    if (this.currentRequestId !== null) {
      this.cancel(this.currentRequestId, new Error('superseded by a newer request'));
    }

    const requestId = this.nextRequestId++;
    this.currentRequestId = requestId;

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { onCoarse, resolve, reject });
      this.worker.postMessage({ type: 'computeCoverage', requestId, payload });
    });
  }

  private cancel(requestId: number, reason: unknown): void {
    this.worker.postMessage({ type: 'cancel', requestId });
    const pending = this.pending.get(requestId);
    if (pending) {
      this.pending.delete(requestId);
      pending.reject(reason);
    }
  }

  private handleMessage(response: CoverageGridWorkerResponse): void {
    const pending = this.pending.get(response.requestId);
    if (!pending) return; // superseded/cancelled request -- drop silently

    if (response.type === 'error') {
      this.pending.delete(response.requestId);
      if (this.currentRequestId === response.requestId) this.currentRequestId = null;
      pending.reject(new Error(response.message));
      return;
    }

    if (response.type === 'cancelled') {
      this.pending.delete(response.requestId);
      if (this.currentRequestId === response.requestId) this.currentRequestId = null;
      return;
    }

    if (response.pass === 'coarse') {
      pending.onCoarse?.(response.result);
      return;
    }

    this.pending.delete(response.requestId);
    if (this.currentRequestId === response.requestId) this.currentRequestId = null;
    pending.resolve(response.result);
  }

  /** Terminates the underlying worker and rejects any still-pending request. */
  destroy(): void {
    for (const [requestId, pending] of this.pending) {
      pending.reject(new Error('client destroyed'));
      this.pending.delete(requestId);
    }
    this.currentRequestId = null;
    this.worker.terminate?.();
  }
}
