/**
 * Free-space spreading loss and ionospheric (D-layer) absorption — the
 * first half of the link budget (physics-and-fidelity.md §4.2).
 *
 * All distances km, frequencies MHz, angles radians (converted to degrees
 * only where the formula itself is defined in degrees, e.g. solar zenith).
 */

const DEG_TO_RAD = Math.PI / 180;

/** Mid-latitude electron gyrofrequency (MHz), constant. */
const D_LAYER_GYROFREQUENCY_MHZ = 1.2;

/**
 * The model's one fitted parameter (physics-and-fidelity.md §4.2 — the
 * literature disagrees on its value). Calibrated against V10-V13
 * (validation.test.ts) rather than derived: the literature-cited starting
 * value of 677.2 was verified, not assumed — a sweep from 60 to 900 showed
 * the four checks only hold simultaneously for K roughly in [595, 735]
 * (below ~595 Anchor B's CW verdict is "Good" instead of the required
 * "Marginal"; above ~735 it drops to "Unlikely"), and 677.2 sits centrally
 * in that window with comfortable margin on every bucket boundary — see the
 * PR description for the full sweep. No adjustment from the literature
 * figure was needed, but this was confirmed, not assumed.
 */
const ABSORPTION_CALIBRATION_K = 677.2;

/**
 * Free-space spreading loss (dB) over the true point-to-point slant
 * distance (sum of every hop's full slant path — up-leg + down-leg — not
 * ground range).
 */
export function freeSpaceSpreadingLossDb(totalSlantPathKm: number, frequencyMhz: number): number {
  return 32.44 + 20 * Math.log10(totalSlantPathKm) + 20 * Math.log10(frequencyMhz);
}

/**
 * Approximate sunspot number from solar flux index, for callers that only
 * have SFI (e.g. from a Conditions UI, a later phase) and need SSN for
 * {@link ionosphericAbsorptionDbPerHop}.
 */
export function ssnFromSfi(sfi: number): number {
  return (sfi - 63.75) / 0.728;
}

/**
 * D-layer non-deviative absorption (dB) for ONE hop, per the absorption-index
 * form:
 *
 *   L_abs = K . sec(phi_D) . (1 + 0.0037*SSN) . [cos(0.881*chi)]^1.3 / (f + f_H)^1.98
 *
 * `incidenceAngleAtDLayerRad` is phi_D, the incidence angle at 90km (D's
 * absorbing-region height, not a reflection height) for this hop's takeoff
 * angle — compute it as `incidenceAngleRad(takeoffAngleRad, 90)` from
 * geometry.ts. `solarZenithDeg` is this hop's solar zenith angle at its
 * midpoint; the bracket term is clamped to exactly zero at chi >= 90 deg
 * (no D layer at night) rather than let `cos` go negative and get raised to
 * a fractional power.
 *
 * Callers summing a multi-hop path must call this once per hop (each hop's
 * own phi_D and chi) and sum the results — this function does not do that
 * summation itself.
 */
export function ionosphericAbsorptionDbPerHop(
  incidenceAngleAtDLayerRad: number,
  ssn: number,
  solarZenithDeg: number,
  frequencyMhz: number,
): number {
  const secPhiD = 1 / Math.cos(incidenceAngleAtDLayerRad);
  const chiTerm =
    solarZenithDeg >= 90 ? 0 : Math.pow(Math.cos(0.881 * solarZenithDeg * DEG_TO_RAD), 1.3);
  return (
    (ABSORPTION_CALIBRATION_K * secPhiD * (1 + 0.0037 * ssn) * chiTerm) /
    Math.pow(frequencyMhz + D_LAYER_GYROFREQUENCY_MHZ, 1.98)
  );
}
