/**
 * Reliability — never a boolean "reachable" (a direct ticket acceptance
 * criterion). Combines two independent uncertainties via the standard
 * normal CDF (physics-and-fidelity.md §4.6):
 *
 *   P_muf = Phi( (MUF - f) / (0.15 * MUF) )   day-to-day MUF spread ~ 15%
 *   P_snr = Phi( margin_dB / 8 )              day-to-day fading sigma ~ 8dB
 *   reliability = P_muf * P_snr
 *
 * Bucket for display: Good >= 70%, Marginal 30-70%, Unlikely < 30%.
 */

import { modeMarginDb, type Mode } from './modes';

// Abramowitz & Stegun 7.1.26 rational approximation to erf, accurate to
// ~1.5e-7 -- more than enough precision for a reliability model with
// hand-fitted constants elsewhere. JS has no built-in erf/CDF.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  const y = 1 - poly * Math.exp(-ax * ax);
  return sign * y;
}

/** Standard normal CDF, Phi(x). */
export function standardNormalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Probability the true MUF is at or above the operating frequency today. */
export function pMuf(mufMhz: number, frequencyMhz: number): number {
  return standardNormalCdf((mufMhz - frequencyMhz) / (0.15 * mufMhz));
}

/** Probability the SNR margin is sufficient today, given day-to-day fading. */
export function pSnr(marginDb: number): number {
  return standardNormalCdf(marginDb / 8);
}

/** Combined reliability (0..1) from the two independent probability terms. */
export function reliability(pMufValue: number, pSnrValue: number): number {
  return pMufValue * pSnrValue;
}

export type ReliabilityBucket = 'good' | 'marginal' | 'unlikely';

export function reliabilityBucket(reliabilityValue: number): ReliabilityBucket {
  if (reliabilityValue >= 0.7) return 'good';
  if (reliabilityValue >= 0.3) return 'marginal';
  return 'unlikely';
}

export interface ModeVerdict {
  mode: Mode;
  marginDb: number;
  reliability: number;
  bucket: ReliabilityBucket;
}

/** Assembles a mode's numeric margin, reliability and display bucket in one call. */
export function modeVerdict(
  mufMhz: number,
  frequencyMhz: number,
  snrDb2400: number,
  mode: Mode,
): ModeVerdict {
  const marginDb = modeMarginDb(snrDb2400, mode);
  const reliabilityValue = reliability(pMuf(mufMhz, frequencyMhz), pSnr(marginDb));
  return {
    mode,
    marginDb,
    reliability: reliabilityValue,
    bucket: reliabilityBucket(reliabilityValue),
  };
}
