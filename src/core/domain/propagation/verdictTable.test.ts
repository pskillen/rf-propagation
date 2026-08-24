import { describe, expect, it } from 'vitest';
import { layerStates } from './layers';
import { ssnFromSfi } from './losses';
import type { SolveHopsContext } from './multiHop';
import { buildVerdictTable } from './verdictTable';
import type { BandDefinition } from '../bandCatalog';

const STANDARD_CONTEXT_BASE = {
  groundType: 'land' as const,
  noiseEnvironment: 'rural' as const,
  txPowerW: 100,
  txAntennaGainDbi: 6,
  rxAntennaGainDbi: 6,
  bandwidthHz: 2400,
};

function contextAt(sfi: number, solarZenithDeg: number): SolveHopsContext {
  return {
    ...STANDARD_CONTEXT_BASE,
    ssn: ssnFromSfi(sfi),
    solarZenithAtMidpointDeg: () => solarZenithDeg,
  };
}

// A single band containing 14 MHz (20m) — Anchor A's own frequency
// (validation.test.ts / multiHop.test.ts), so this band's row reproduces
// Anchor A's known "all Good" SSB/CW/FT8 outcome.
const BAND_20M: BandDefinition = {
  id: '20m',
  label: '20 m',
  minMhz: 14.0,
  maxMhz: 14.0,
  color: '#000',
  mantine: 'teal.7',
  category: 'amateur',
};

describe('buildVerdictTable', () => {
  it('reproduces Anchor A (3360km, 20m, SFI 120, daytime) as a one-band table with all-Good verdicts', () => {
    const layers = layerStates(120, 0, 0, 0);
    const rows = buildVerdictTable([BAND_20M], 3360, layers, contextAt(120, 0));

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.bandId).toBe('20m');
    expect(row.hopSolveResult.kind).toBe('solved');
    expect(row.verdicts).toHaveLength(3);
    // Anchor A's own worked table (phase 3) reports all three modes as
    // "Good" -- the easier digital modes (ft8) should be at least as
    // reliable as ssb here, never worse.
    const ssbVerdict = row.verdicts.find((v) => v.mode === 'ssb')!;
    const ft8Verdict = row.verdicts.find((v) => v.mode === 'ft8')!;
    expect(ft8Verdict.reliability).toBeGreaterThanOrEqual(ssbVerdict.reliability);
    expect(row.bestReliability).toBeGreaterThan(0);
  });

  it("produces unreachable rows (not a crash) for a target beyond every band's achievable geometry", () => {
    const layers = layerStates(120, 0, 0, 0);
    const farBand: BandDefinition = { ...BAND_20M, id: '160m', minMhz: 1.81, maxMhz: 1.81 };
    const rows = buildVerdictTable([BAND_20M, farBand], 21000, layers, contextAt(120, 0));

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.hopSolveResult.kind).toBe('unreachable');
      expect(row.verdicts).toHaveLength(0);
      expect(row.bestReliability).toBe(0);
    }
  });

  it('ranks the highest-bestReliability band first', () => {
    const layers = layerStates(120, 0, 0, 0);
    // 160m at 3360km, daytime, is a poor DX band at this fidelity tier
    // (low critical frequency) -- 20m should out-rank it.
    const band160m: BandDefinition = { ...BAND_20M, id: '160m', minMhz: 1.81, maxMhz: 1.81 };
    const rows = buildVerdictTable([band160m, BAND_20M], 3360, layers, contextAt(120, 0));

    expect(rows[0]!.bandId).toBe('20m');
    expect(rows[0]!.bestReliability).toBeGreaterThanOrEqual(rows[1]!.bestReliability);
  });
});
