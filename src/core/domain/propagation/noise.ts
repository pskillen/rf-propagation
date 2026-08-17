/**
 * ITU-R P.372 man-made noise floor, taken as the greater of man-made and
 * galactic noise (physics-and-fidelity.md §4.4):
 *
 *   Fam_manmade  = c - d * log10(f_MHz)
 *   Fam_galactic = 52 - 23 * log10(f_MHz)
 *   N_dBm = -174 + max(Fam_manmade, Fam_galactic) + 10*log10(B_Hz)
 *
 * Known simplification, worth stating plainly (physics-and-fidelity.md §7,
 * "Not modelled"): atmospheric (thunderstorm) noise is NOT modelled here.
 * It dominates 160m/80m, especially at night and in summer, so this model
 * will read optimistically on the low bands. This is a documented fidelity
 * gap, not a bug — it needs to surface in the UI in a later phase (F13.3),
 * not be silently fixed in this module.
 */

export type NoiseEnvironment = 'urban' | 'residential' | 'rural' | 'quietRural';

const NOISE_COEFFICIENTS: Record<NoiseEnvironment, { c: number; d: number }> = {
  urban: { c: 76.8, d: 27.7 },
  residential: { c: 72.5, d: 27.7 },
  rural: { c: 67.2, d: 27.7 },
  quietRural: { c: 53.6, d: 28.6 },
};

const GALACTIC_NOISE_C = 52;
const GALACTIC_NOISE_D = 23;

/**
 * Noise floor (dBm) for a given frequency, man-made noise environment and
 * receiver bandwidth. `bandwidthHz` must always be passed explicitly —
 * never assumed or hardcoded — since skipping it is "the trap that makes
 * SNR comparisons meaningless" (physics-and-fidelity.md §4.4). The
 * reference bandwidth for the mode thresholds in modes.ts is 2400 Hz.
 */
export function noiseFloorDbm(
  frequencyMhz: number,
  environment: NoiseEnvironment,
  bandwidthHz: number,
): number {
  const { c, d } = NOISE_COEFFICIENTS[environment];
  const famManMade = c - d * Math.log10(frequencyMhz);
  const famGalactic = GALACTIC_NOISE_C - GALACTIC_NOISE_D * Math.log10(frequencyMhz);
  return -174 + Math.max(famManMade, famGalactic) + 10 * Math.log10(bandwidthHz);
}
