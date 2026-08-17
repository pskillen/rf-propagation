/**
 * Required SNR per mode, normalised to a 2.4kHz reference bandwidth so one
 * SNR number (`snrDb2400`, computed at that bandwidth) serves every mode
 * (physics-and-fidelity.md §4.5).
 *
 * This module produces the numeric dB margin only. The Good/Marginal/
 * Unlikely bucket lives in reliability.ts, not here — it needs both this
 * module's margin and a MUF-based term, so the actual "verdict" isn't
 * assembled until reliability.ts's `modeVerdict`.
 */

export type Mode = 'ssb' | 'cw' | 'ft8' | 'wspr';

export const MODE_THRESHOLD_DB_2400HZ: Record<Mode, number> = {
  ssb: 6,
  cw: -7,
  ft8: -21,
  wspr: -29,
};

/** SNR margin (dB) above (positive) or below (negative) a mode's threshold. */
export function modeMarginDb(snrDb2400: number, mode: Mode): number {
  return snrDb2400 - MODE_THRESHOLD_DB_2400HZ[mode];
}
