/**
 * "Best band right now," ranked across the operator's available bands
 * (F5.4, Slice 4) — runs a full coverage-grid sweep once per band in the
 * amateur catalogue, only when Station/Conditions actually change (NOT on
 * every drag-frame; this is a summary-strip figure, not part of the live-
 * drag surface).
 *
 * `UK_AMATEUR_BANDS` is used unfiltered — F5.4's own text says this should
 * exclude bands outside the operator's licence class, but neither Station
 * nor Conditions models a licence class anywhere in this repo yet
 * (`BandChips.tsx`, phase 7, already flagged this exact gap and made the
 * same call: surface what data exists, don't invent a licence-class
 * selector this phase has no spec or UI slot for).
 *
 * Deliberately uses its OWN `CoverageGridClient` (own Worker), not the
 * live-drag surface's client from `useReachCoverage` — that client tracks
 * at most one in-flight request and cancels the previous one on every new
 * `compute()` call; sharing it here would risk this sweep's own sequential
 * per-band calls cancelling each other, or a live drag cancelling a
 * band-ranking sweep (or vice versa). The phase plan says "via the same
 * Worker client" meaning the same CLIENT MECHANISM (Worker + typed
 * request/response), not literally the same instance — flagged here as
 * the concrete reading taken, since a literal single-instance reading
 * would silently corrupt one surface's in-flight result with the other's.
 */
import { useEffect, useRef, useState } from 'react';
import type { Station } from '@core/domain/station/types';
import type { Conditions } from '@core/domain/conditions/types';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import { UK_AMATEUR_BANDS, bandMidpointMhz } from '@core/domain/bandCatalog';
import { CoverageGridClient } from '@integrations/propagation/coverageGridClient';
import { buildCoverageGridInput } from './buildCoverageGridInput.ts';
import { rankBandsByMeanReliability, type BandRanking } from './reachSummary.ts';

export function useBestBandNow(
  station: Station,
  conditions: Conditions,
  /** Test seam -- production code never passes this. */
  clientFactory: () => CoverageGridClient = () => new CoverageGridClient(),
): BandRanking[] {
  const clientRef = useRef<CoverageGridClient | null>(null);

  // Created and destroyed inside the SAME effect, not created eagerly
  // during render -- see useReachCoverage.ts's identical fix for the full
  // explanation: a client created during render and only torn down in an
  // effect cleanup is permanently killed by React 19 StrictMode's
  // dev-only double-invoke of effects (mount -> cleanup -> mount again),
  // since nothing re-runs the render-time creation check afterward. Caught
  // via live browser verification (the band-ranking sweep hung on
  // "Ranking bands…" forever), not the test suite.
  useEffect(() => {
    const client = clientFactory();
    clientRef.current = client;
    return () => {
      client.destroy();
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rankings, setRankings] = useState<BandRanking[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const resultsByBand = new Map<string, CoverageGridResult>();
      for (const band of UK_AMATEUR_BANDS) {
        if (cancelled || clientRef.current == null) return;
        const input = buildCoverageGridInput(station, conditions, bandMidpointMhz(band.id));
        try {
          // Sequential, awaited -- this client tracks one in-flight
          // request at a time, so firing all bands' requests without
          // awaiting would just cancel every one but the last.
          const result = await clientRef.current.compute(input);
          resultsByBand.set(band.id, result);
        } catch {
          // Cancelled (unmount destroyed the client) or errored -- skip
          // this band rather than aborting the whole ranking sweep.
        }
      }
      if (!cancelled) setRankings(rankBandsByMeanReliability(resultsByBand));
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [station, conditions]);

  return rankings;
}
