/**
 * Worker entry point -- runs ONLY inside a real Worker thread (created via
 * `new Worker(new URL('./coverageWorker.ts', import.meta.url), { type:
 * 'module' })`, see coverageGridClient.ts). The actual message-handling
 * logic lives in coverageWorkerHandler.ts as a plain, directly-testable
 * function; this file is a thin adapter onto the real Worker globals.
 *
 * Typing note: this project's tsconfig.app.json's `lib` is DOM-only (no
 * `WebWorker` lib -- the two conflict if both are included in the same
 * tsconfig, and this is the only file in the repo that needs worker-global
 * types), so `self` is declared locally below with just the two members
 * this file actually uses, rather than pulling the WebWorker lib in
 * project-wide for one file.
 */

import { createCoverageWorkerHandler } from './coverageWorkerHandler';
import type { CoverageGridWorkerMessage } from './protocol';

declare const self: {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<CoverageGridWorkerMessage>) => void) | null;
};

const handleMessage = createCoverageWorkerHandler((response, transfer) => {
  self.postMessage(response, transfer);
});

self.onmessage = (event) => handleMessage(event.data);
