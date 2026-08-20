/**
 * Antenna angle-shortfall calculation (F10.3, [#71]) — "does the active
 * antenna actually radiate at the angle this hop needs, or is a
 * physically-fine link budget masking a real-world disappointment
 * because the antenna's own pattern is weak there." Takes a generic
 * elevation-gain lookup rather than importing `@core/domain/antenna`
 * directly, so it's testable against a synthetic fixture independent of
 * the real antenna pattern module (per this phase's own test-plan note)
 * — `PathPage.tsx` is the real caller, passing
 * `(elevationDeg) => elevationGainDbi(activeAntenna, elevationDeg,
 * bearingDeg, frequencyMhz)`.
 *
 * Threshold, a judgment call flagged since neither ux-and-ia.md nor
 * product-requirements.md gives one numerically: >6dB below the
 * antenna's own peak roughly halves the effective radiated power at that
 * angle, which is the kind of gap worth calling out explicitly (per
 * ux-and-ia.md §4.2's own worked example: "20m needs 8°; your dipole at
 * 6m puts −9dB there").
 *
 * [#71]: https://github.com/pskillen/rf-propagation/issues/71
 */

/** Gain shortfall (dB) below this antenna's own elevation-pattern peak flags a real-world gap. */
export const ANGLE_SHORTFALL_THRESHOLD_DB = 6;

export interface AngleShortfallResult {
  requiredElevationDeg: number;
  gainAtRequiredElevationDbi: number;
  peakElevationDeg: number;
  peakGainDbi: number;
  /** `peakGainDbi - gainAtRequiredElevationDbi`, always >= 0 by construction (peak is a max over the same lookup). */
  shortfallDb: number;
  /** `true` when `shortfallDb` exceeds `ANGLE_SHORTFALL_THRESHOLD_DB`. */
  flagged: boolean;
}

/**
 * Scans `gainAtElevationDbi` over 0-90 degrees (1 degree steps, matching
 * `@core/domain/antenna/antennaPattern.ts`'s own `peakGainElevationDeg`
 * scan resolution) to find the antenna's own peak, then compares the
 * gain at `requiredElevationDeg` against it.
 */
export function computeAngleShortfall(
  requiredElevationDeg: number,
  gainAtElevationDbi: (elevationDeg: number) => number,
): AngleShortfallResult {
  let peakElevationDeg = 0;
  let peakGainDbi = Number.NEGATIVE_INFINITY;
  for (let elevationDeg = 0; elevationDeg <= 90; elevationDeg += 1) {
    const gainDbi = gainAtElevationDbi(elevationDeg);
    if (gainDbi > peakGainDbi) {
      peakGainDbi = gainDbi;
      peakElevationDeg = elevationDeg;
    }
  }

  const gainAtRequiredElevationDbi = gainAtElevationDbi(requiredElevationDeg);
  const shortfallDb = peakGainDbi - gainAtRequiredElevationDbi;

  return {
    requiredElevationDeg,
    gainAtRequiredElevationDbi,
    peakElevationDeg,
    peakGainDbi,
    shortfallDb,
    flagged: shortfallDb > ANGLE_SHORTFALL_THRESHOLD_DB,
  };
}
