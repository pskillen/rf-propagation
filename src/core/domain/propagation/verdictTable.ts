/**
 * Band x mode verdict table (F10.2, Path's own surface, phase 13) — the
 * first UI consumer of `solveHopsForDistance` (phase 4's own cross-phase
 * note names Path explicitly). For a known ground range and the Station's
 * usable bands, this ranks "can I work that station, on what modes, and
 * why or why not" best-first.
 *
 * No new engine code, no new formulas — this module calls
 * `solveHopsForDistance` + `modeVerdict` once per band, exactly the
 * per-band pattern phase 4's own multi-hop tests already exercise.
 */
import type { BandDefinition } from '../bandCatalog';
import { solveHopsForDistance, type HopSolveResult, type SolveHopsContext } from './multiHop';
import { modeVerdict, type ModeVerdict } from './reliability';
import type { LayerState } from './layers';
import type { Mode } from './modes';

/**
 * Modes rendered in the default table — SSB/CW/FT8 (F2.8/FR-8), not WSPR.
 */
export const VERDICT_TABLE_MODES: readonly Mode[] = ['ssb', 'cw', 'ft8'];

export interface VerdictRow {
  bandId: string;
  /** Straight from `solveHopsForDistance` — 'solved' | 'unreachable'; never collapsed into a boolean. */
  hopSolveResult: HopSolveResult;
  /** One per `VERDICT_TABLE_MODES` entry; empty when `hopSolveResult.kind === 'unreachable'`. */
  verdicts: ModeVerdict[];
  /** Max reliability across `verdicts`, for ranking — 0 when unreachable. */
  bestReliability: number;
}

function bestReliabilityOf(verdicts: ModeVerdict[]): number {
  return verdicts.reduce((max, v) => Math.max(max, v.reliability), 0);
}

/**
 * Builds one ranked `VerdictRow` per band, best-first (F10.2's own direct
 * acceptance criterion). `midFrequencyMhz` per band — the band's own
 * midpoint, per this module's own judgment call: neither Reach nor
 * Explore's existing verdict-style computations (Compare's
 * `buildSideVerdicts`, Explore's link-budget breakdown) read a
 * per-band-within-the-table tuned frequency from the Conditions bar
 * either, they use whichever single `frequencyMhz` the caller already
 * has — this table needs one frequency PER BAND (there is no single
 * "currently tuned" frequency across ten different bands at once), so the
 * band's own midpoint is the only value available without inventing a
 * new per-band frequency picker.
 */
export function buildVerdictTable(
  bands: BandDefinition[],
  groundRangeKm: number,
  layers: LayerState[],
  context: SolveHopsContext,
): VerdictRow[] {
  return bands
    .map((band) => {
      const midFrequencyMhz = (band.minMhz + band.maxMhz) / 2;
      const hopSolveResult = solveHopsForDistance(groundRangeKm, midFrequencyMhz, layers, context);
      const verdicts =
        hopSolveResult.kind === 'solved'
          ? VERDICT_TABLE_MODES.map((mode) =>
              modeVerdict(
                hopSolveResult.solution.linkBudget.mufMhz,
                midFrequencyMhz,
                hopSolveResult.solution.linkBudget.snrDb2400,
                mode,
              ),
            )
          : [];
      return {
        bandId: band.id,
        hopSolveResult,
        verdicts,
        bestReliability: bestReliabilityOf(verdicts),
      };
    })
    .sort((a, b) => b.bestReliability - a.bestReliability);
}
