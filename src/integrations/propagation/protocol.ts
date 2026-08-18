/**
 * Coverage-grid Worker protocol (F2.14) -- id-correlated request/response
 * over a Web Worker, in the shape ported from Codeplug Studio's
 * `hfPropagation/protocol.ts` (RayTraceWorkerRequest/Response), but NOT its
 * payload: this carries `CoverageGridInput`/`CoverageGridResult` (typed
 * arrays, transferable), and extends the request side with a `cancel`
 * message (Slice 5, F2.15) Studio's mk1 protocol never needed (mk1 had no
 * real cancellation -- see the phase plan's Context section).
 *
 * `CoverageGridWorkerRequest`'s shape matches the phase plan's literal
 * Slice 4 snippet unchanged; `CancelWorkerRequest` and the
 * `CoverageGridWorkerMessage` union that combines them are additive,
 * introduced for Slice 5.
 */

import type { CoverageGridInput, CoverageGridResult } from '@core/domain/propagation/coverageGrid';

export interface CoverageGridWorkerRequest {
  type: 'computeCoverage';
  requestId: number;
  /** Must be structured-cloneable (plain data -- see CoverageGridInput's own fields). */
  payload: CoverageGridInput;
}

/** Slice 5 (F2.15): cancels a previously-issued `computeCoverage` request, by id. */
export interface CancelWorkerRequest {
  type: 'cancel';
  requestId: number;
}

/** Every message shape the client posts TO the worker. */
export type CoverageGridWorkerMessage = CoverageGridWorkerRequest | CancelWorkerRequest;

/**
 * Every message shape the worker posts back. `result` carries
 * `CoverageGridResult`'s Float32Array/Uint8Array fields as TRANSFERABLES
 * (their `.buffer`s passed as postMessage's second argument), not
 * structured-cloned -- a direct FR-22/F2.14 requirement. `pass` lets one
 * `requestId` legitimately produce two `result` responses (Slice 5's
 * coarse-then-fine two-pass).
 */
export type CoverageGridWorkerResponse =
  | { type: 'result'; requestId: number; pass: 'coarse' | 'fine'; result: CoverageGridResult }
  | { type: 'error'; requestId: number; message: string }
  | { type: 'cancelled'; requestId: number };
