/**
 * Best-band-now summary strip (F5.4, Slice 4) — two pure, directly
 * testable pieces:
 *
 * 1. `reachExtremes` walks the CURRENT band's already-computed
 *    `CoverageGridResult` (no extra engine call) for the current band's
 *    own reach figures — "groundwave to X km, dead to Y km, first hop
 *    Y-Z km" (ux-and-ia.md §4.1's own wording).
 * 2. `rankBandsByMeanReliability` ranks several bands' grids by mean
 *    reliability over cells that have ANY coverage (`hopCount !== 255`),
 *    ignoring the skip zone rather than letting a large skip zone drag
 *    every band's average down near-equally. JUDGMENT CALL, FLAGGED (per
 *    the phase plan): this scoring isn't specified anywhere in the design
 *    doc set — a reasonable, documented choice, not a derived spec value.
 */
import { COVERAGE_NO_DATA } from './cellFillStyle.ts';

interface CoverageGridLike {
  azimuthCount: number;
  rangeBinCount: number;
  rangeBinKm: number;
  reliability: Float32Array;
  hopCount: Uint8Array;
}

export interface ReachExtreme {
  hopCount: number;
  /** Km from the station -- the nearest populated cell's inner edge. */
  minRangeKm: number;
  /** Km from the station -- the furthest populated cell's outer edge. */
  maxRangeKm: number;
}

/**
 * For each `hopCount` category (0 = groundwave, 1-4 = hop number) present
 * anywhere in `result`, finds the min/max populated `rangeBin` across ALL
 * azimuths and converts to km. Categories with no populated cell at all
 * are simply absent from the result (not zero-filled) — sorted by
 * `hopCount` ascending, so groundwave always leads.
 */
export function reachExtremes(result: CoverageGridLike): ReachExtreme[] {
  const minBin = new Map<number, number>();
  const maxBin = new Map<number, number>();

  for (let az = 0; az < result.azimuthCount; az++) {
    for (let bin = 0; bin < result.rangeBinCount; bin++) {
      const idx = az * result.rangeBinCount + bin;
      const hopCount = result.hopCount[idx];
      if (hopCount === COVERAGE_NO_DATA) continue;

      const currentMin = minBin.get(hopCount);
      if (currentMin === undefined || bin < currentMin) minBin.set(hopCount, bin);
      const currentMax = maxBin.get(hopCount);
      if (currentMax === undefined || bin > currentMax) maxBin.set(hopCount, bin);
    }
  }

  return Array.from(minBin.keys())
    .sort((a, b) => a - b)
    .map((hopCount) => ({
      hopCount,
      minRangeKm: minBin.get(hopCount)! * result.rangeBinKm,
      maxRangeKm: (maxBin.get(hopCount)! + 1) * result.rangeBinKm,
    }));
}

/**
 * Plain-language "groundwave to X km, dead to Y km, first hop Y-Z km"
 * (ux-and-ia.md §4.1) built from `reachExtremes`' output. The "dead to Y"
 * clause only appears when there's an actual gap between groundwave's
 * outer edge and the first hop's inner edge (a real skip zone) — a grid
 * with no gap (groundwave running straight into hop 1) omits it rather
 * than claiming a dead zone that isn't there.
 */
export function formatReachExtremes(extremes: ReachExtreme[]): string {
  if (extremes.length === 0) return 'No coverage in this band right now.';

  const groundwave = extremes.find((e) => e.hopCount === 0);
  const firstHop = extremes.find((e) => e.hopCount >= 1);

  const parts: string[] = [];
  if (groundwave) parts.push(`groundwave to ${Math.round(groundwave.maxRangeKm)} km`);
  if (groundwave && firstHop && firstHop.minRangeKm > groundwave.maxRangeKm) {
    parts.push(`dead to ${Math.round(firstHop.minRangeKm)} km`);
  }
  if (firstHop) {
    parts.push(
      `first hop ${Math.round(firstHop.minRangeKm)}-${Math.round(firstHop.maxRangeKm)} km`,
    );
  }
  if (parts.length === 0) {
    // Coverage exists but is entirely hop 2+ (no groundwave, no hop 1 in this grid) -- fall back to the highest-priority entry we do have.
    const first = extremes[0];
    parts.push(
      `hop ${first.hopCount} ${Math.round(first.minRangeKm)}-${Math.round(first.maxRangeKm)} km`,
    );
  }
  return parts.join(', ');
}

export interface BandRanking {
  bandId: string;
  /** Mean reliability over cells where hopCount !== 255 (ignores the skip zone) -- see this module's header for why. */
  meanReliability: number;
}

/**
 * Ranks bands by mean reliability over covered cells only, descending
 * (best first). A band with NO covered cells anywhere scores 0 rather
 * than being excluded, so it still appears (last) rather than silently
 * disappearing from the ranking.
 */
export function rankBandsByMeanReliability(
  resultsByBand: ReadonlyMap<string, CoverageGridLike>,
): BandRanking[] {
  const rankings: BandRanking[] = [];

  for (const [bandId, result] of resultsByBand) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < result.hopCount.length; i++) {
      if (result.hopCount[i] === COVERAGE_NO_DATA) continue;
      sum += result.reliability[i];
      count++;
    }
    rankings.push({ bandId, meanReliability: count > 0 ? sum / count : 0 });
  }

  return rankings.sort((a, b) => b.meanReliability - a.meanReliability);
}
