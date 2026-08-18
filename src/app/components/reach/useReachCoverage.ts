/**
 * Owns the coverage-grid Worker client for Reach (Slice 2, F5.2) — one
 * `CoverageGridClient` per mount, recomputing whenever Station/Conditions/
 * frequency change AND whenever `recompute(qth)` is called directly with
 * an explicit override (the live-drag path, Slice 1/2).
 *
 * "Fire a new request on every drag-move event, let the client's own
 * supersede logic handle the rest" (phase 4's own instruction) — this hook
 * does NOT debounce `recompute`; `CoverageGridClient.compute()`'s own
 * cancel-on-supersede contract is what keeps "rapid successive requests
 * leave exactly one fine result standing" true here, exactly as it does in
 * `coverageGridClient.test.ts`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Station } from '@core/domain/station/types';
import type { Conditions } from '@core/domain/conditions/types';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import { CoverageGridClient } from '@integrations/propagation/coverageGridClient';
import { buildCoverageGridInput } from './buildCoverageGridInput.ts';

export type CoveragePass = 'coarse' | 'fine';

export interface UseReachCoverageResult {
  result: CoverageGridResult | null;
  pass: CoveragePass | null;
  /** Recomputes at an explicit qth override (e.g. the marker's live drag position) — falls back to `station.qth` if omitted. */
  recompute: (qthOverride?: { lat: number; lon: number }) => void;
}

export function useReachCoverage(
  station: Station,
  conditions: Conditions,
  frequencyMhz: number,
  /** Test seam — production code never passes this, letting `CoverageGridClient` construct its real Worker. */
  clientFactory: () => CoverageGridClient = () => new CoverageGridClient(),
): UseReachCoverageResult {
  const clientRef = useRef<CoverageGridClient | null>(null);
  if (clientRef.current == null) clientRef.current = clientFactory();

  useEffect(() => {
    const client = clientRef.current;
    return () => client?.destroy();
  }, []);

  const [state, setState] = useState<{
    result: CoverageGridResult | null;
    pass: CoveragePass | null;
  }>({ result: null, pass: null });

  const recompute = useCallback(
    (qthOverride?: { lat: number; lon: number }) => {
      const input = buildCoverageGridInput(
        station,
        conditions,
        frequencyMhz,
        qthOverride ?? station.qth,
      );
      clientRef
        .current!.compute(input, (coarse) => setState({ result: coarse, pass: 'coarse' }))
        .then((fine) => setState({ result: fine, pass: 'fine' }))
        .catch(() => {
          // Superseded/cancelled by a newer recompute() call, or the client
          // was destroyed on unmount -- the newer call's own resolution (or
          // the unmount itself) already covers this; nothing to surface.
        });
    },
    [station, conditions, frequencyMhz],
  );

  // Recompute whenever Station/Conditions/frequency change for reasons
  // OTHER than a live drag (e.g. editing power/antenna/SFI in the chrome
  // bars) -- Reach's shading must reflect those too, not just marker drags.
  useEffect(() => {
    recompute();
  }, [recompute]);

  return { result: state.result, pass: state.pass, recompute };
}
