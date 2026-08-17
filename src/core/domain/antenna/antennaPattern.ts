/**
 * Antenna pattern-family gain-shape math, ported verbatim from Codeplug
 * Studio's src/core/domain/hfPropagation/antennaPatterns.ts
 * (`wavelengthM`, `groundReflectionFactor`, `antennaGain`,
 * `peakGainElevationDeg`), against this repo's own `AntennaConfig`
 * (`@core/domain/station/types` — same `family`/`heightM`/`azimuthDeg`/
 * `wireLengthWavelengths` shape mk1's function signatures already expect;
 * only `gainDbi` is new and unused by these ported functions themselves).
 *
 * Filed under its own `antenna/` domain subfolder, not `station/` — the
 * pattern-shape math is antenna physics, independent of any particular
 * Station. This is this phase's own filing choice, flagged since neither
 * design doc specifies it.
 */

import type { AntennaConfig } from '../station/types';

const SPEED_OF_LIGHT_M_PER_S = 299_792_458;

/** Wavelength in metres for a given frequency in MHz — c / f. */
export function wavelengthM(frequencyMhz: number): number {
  return SPEED_OF_LIGHT_M_PER_S / (frequencyMhz * 1e6);
}

/**
 * Ground-reflection factor for a horizontal antenna at height h (metres) above ground, at
 * elevation angle thetaDeg, wavelength lambdaM. Governs NVIS-vs-DX behaviour for family 2.
 */
export function groundReflectionFactor(thetaDeg: number, heightM: number, lambdaM: number): number {
  const thetaRad = (thetaDeg * Math.PI) / 180;
  return 2 * Math.sin(((2 * Math.PI * heightM) / lambdaM) * Math.sin(thetaRad));
}

/**
 * Antenna gain (relative, not absolute dBi — this is a shape function for ray-tracing input
 * power weighting, not a calibrated antenna model) at elevation thetaDeg and azimuth phiDeg,
 * for the given antenna configuration and operating frequency. Returns a value in [0, ~2] —
 * `elevationGainDbi` below is what turns this into an absolute dBi figure.
 */
export function antennaGain(
  antenna: AntennaConfig,
  thetaDeg: number,
  phiDeg: number,
  frequencyMhz: number,
): number {
  const thetaRad = (thetaDeg * Math.PI) / 180;
  const lambdaM = wavelengthM(frequencyMhz);

  switch (antenna.family) {
    case 'omnidirectional-vertical': {
      // A(phi) = 1 (constant); E(theta) = sin(theta) * cos(pi/2 * sin theta)
      return Math.sin(thetaRad) * Math.cos((Math.PI / 2) * Math.sin(thetaRad));
    }
    case 'bidirectional-transverse': {
      const phi0 = antenna.azimuthDeg ?? 0;
      const azimuthGain = Math.abs(Math.cos(((phiDeg - phi0) * Math.PI) / 180));
      const groundFactor = groundReflectionFactor(thetaDeg, antenna.heightM, lambdaM);
      return azimuthGain * Math.abs(groundFactor);
    }
    case 'directional-lobe': {
      const phi0 = antenna.azimuthDeg ?? 0;
      const BEAMWIDTH_EXPONENT_N = 4; // fixed reasonable default beamwidth — not user-adjustable in v1
      const LOW_ANGLE_EXPONENT_M = 3;
      const azimuthGain = Math.cos(((phiDeg - phi0) * Math.PI) / 360) ** (2 * BEAMWIDTH_EXPONENT_N);
      const elevationGain = Math.sin(thetaRad) ** LOW_ANGLE_EXPONENT_M;
      return azimuthGain * elevationGain;
    }
    case 'multi-lobe-conical': {
      const wireLengthWavelengths = antenna.wireLengthWavelengths ?? 2;
      if (thetaRad === 0 || thetaRad === Math.PI) return 0; // avoid division by zero at poles
      const denominator = 1 - Math.cos(thetaRad);
      if (Math.abs(denominator) < 1e-9) return 0;
      const numerator = Math.sin(thetaRad);
      const phase = Math.PI * wireLengthWavelengths * denominator;
      return Math.abs((numerator / denominator) * Math.sin(phase));
    }
  }
}

/**
 * Elevation angle (degrees above horizon) at which `antennaGain` is largest, sampling
 * `theta = 0..90` at 1° steps for the given azimuth and frequency.
 */
export function peakGainElevationDeg(
  antenna: AntennaConfig,
  phiDeg: number,
  frequencyMhz: number,
): number {
  let bestTheta = 0;
  let bestGain = Number.NEGATIVE_INFINITY;
  for (let thetaDeg = 0; thetaDeg <= 90; thetaDeg += 1) {
    const gain = antennaGain(antenna, thetaDeg, phiDeg, frequencyMhz);
    if (gain > bestGain) {
      bestGain = gain;
      bestTheta = thetaDeg;
    }
  }
  return bestTheta;
}

// Avoid -Infinity at pattern nulls; a deep null legitimately reads as a
// large negative but finite dB, not undefined.
const RELATIVE_GAIN_FLOOR = 1e-6;

/** Peak of antennaGain() over elevation 0–90° at the antenna's own peak azimuth. */
function peakRelativeGain(antenna: AntennaConfig, frequencyMhz: number): number {
  const phi0 = antenna.azimuthDeg ?? 0;
  let peak = 0;
  for (let theta = 0; theta <= 90; theta += 1) {
    peak = Math.max(peak, antennaGain(antenna, theta, phi0, frequencyMhz));
  }
  return peak;
}

/**
 * Absolute gain in dBi at the given elevation/azimuth. `antennaGain()`'s own doc comment
 * describes its return value as a multiplicative weight on transmit power — a POWER ratio,
 * not a voltage/field ratio — so the correct conversion is 10*log10(ratio), not
 * 20*log10(ratio).
 *
 * Judgment call: mk1 and physics-and-fidelity.md specify no conversion formula at all;
 * this normalises the relative pattern to unity at its own peak, then scales so the peak
 * equals the antenna's stated `gainDbi`. Not called from anywhere in this phase — phase 8
 * (Reach) is the first caller, feeding a Station's active antenna into
 * `computeCoverageGrid`/`computeLinkBudget`. Its parameter order/return units are treated as
 * load-bearing for phase 13 (Path, F10.3)'s "does the antenna actually radiate at that angle"
 * diagnosis — changing either here needs a heads-up in that phase's plan file.
 */
export function elevationGainDbi(
  antenna: AntennaConfig,
  elevationDeg: number,
  azimuthDeg: number,
  frequencyMhz: number,
): number {
  const relative = antennaGain(antenna, elevationDeg, azimuthDeg, frequencyMhz);
  const peak = peakRelativeGain(antenna, frequencyMhz);
  return (
    antenna.gainDbi +
    10 * Math.log10(Math.max(relative, RELATIVE_GAIN_FLOOR) / Math.max(peak, RELATIVE_GAIN_FLOOR))
  );
}
