/**
 * Ionospheric layer model — each layer gets its OWN critical frequency and
 * virtual height, fixing mk1's root defect (identical density across D/E/F1/F2,
 * which made the D layer — an absorber only — mk1's daytime reflector; see
 * mk1-gap-analysis.md §1.1).
 *
 * All frequencies MHz, all heights km, solar zenith angle and geomagnetic
 * latitude in degrees.
 */

export type LayerId = 'D' | 'E' | 'F1' | 'F2';

export interface LayerState {
  id: LayerId;
  virtualHeightKm: number;
  /** null ⇒ inactive (F1 at night; D has no critical frequency at all — it's never a reflection candidate). */
  criticalFrequencyMhz: number | null;
}

/** D-region virtual height: absorbing region, not a reflection height. */
const D_VIRTUAL_HEIGHT_KM = 90;
const E_VIRTUAL_HEIGHT_KM = 110;
const F1_VIRTUAL_HEIGHT_KM = 200;
const F2_VIRTUAL_HEIGHT_KM_DAY = 300;
const F2_VIRTUAL_HEIGHT_KM_NIGHT = 350;

const F1_DAY_ZENITH_LIMIT_DEG = 75;
/** Zenith angle at/above which F2 uses its night-floor formula and height. */
const F2_NIGHT_ZENITH_THRESHOLD_DEG = 89;
const E_NIGHT_FLOOR_MHZ = 0.5;
const F2_NIGHT_FLOOR_FACTOR = 0.45;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function cosDeg(deg: number): number {
  return Math.cos(deg * (Math.PI / 180));
}

/**
 * foE = 0.9 * [(180 + 1.44*SFI) * cos(chi)]^0.25, floored at 0.5 MHz (night
 * floor — also covers the twilight band where the raw formula would dip
 * below it, and avoids raising a negative base to a fractional power once
 * the sun is below the horizon).
 */
function critE(sfi: number, solarZenithDeg: number): number {
  const cosChi = cosDeg(solarZenithDeg);
  if (cosChi <= 0) return E_NIGHT_FLOOR_MHZ;
  const raw = 0.9 * Math.pow((180 + 1.44 * sfi) * cosChi, 0.25);
  return Math.max(raw, E_NIGHT_FLOOR_MHZ);
}

/**
 * foF1 = (4.25 + 0.01*(SFI-70)) * cos(chi)^0.2 — day only. Returns null when
 * the layer is inactive (chi >= 75deg).
 */
function critF1(sfi: number, solarZenithDeg: number): number | null {
  if (solarZenithDeg >= F1_DAY_ZENITH_LIMIT_DEG) return null;
  const cosChi = cosDeg(solarZenithDeg);
  return (4.25 + 0.01 * (sfi - 70)) * Math.pow(cosChi, 0.2);
}

/**
 * foF2, before the Kp adjustment. foF2_noon = 6.0 + 0.04*(SFI-70). By day
 * (chi < 89deg) uses foF2_noon * cos(chi)^0.25, floored at the night value
 * (0.45 * foF2_noon) so the day curve blends smoothly into the night floor
 * near the terminator rather than dipping below it just before the cutover.
 */
function critF2Base(sfi: number, solarZenithDeg: number): number {
  const foF2Noon = 6.0 + 0.04 * (sfi - 70);
  const nightFloor = F2_NIGHT_FLOOR_FACTOR * foF2Noon;
  if (solarZenithDeg >= F2_NIGHT_ZENITH_THRESHOLD_DEG) return nightFloor;
  const dayValue = foF2Noon * Math.pow(cosDeg(solarZenithDeg), 0.25);
  return Math.max(dayValue, nightFloor);
}

/**
 * Geomagnetic disturbance factor: depresses foF2 toward the auroral zone as
 * Kp rises. Crude but directionally correct — flagged in
 * physics-and-fidelity.md §2 as the least trustworthy part of the model; a
 * real storm's effect on the ionosphere is far more structured (patchy,
 * time-lagged, latitude-banded) than this uniform multiplier.
 */
function kpFactor(kp: number, geomagLatDeg: number): number {
  return 1 - 0.03 * kp * clamp01((Math.abs(geomagLatDeg) - 45) / 45);
}

/**
 * Returns all four layers (D, E, F1, F2) for the given space-weather and
 * solar-geometry inputs. D always has `criticalFrequencyMhz: null` — it is
 * never a reflection candidate; see reflection.ts, which is responsible for
 * excluding it (this function only reports layer state, not selection).
 */
export function layerStates(
  sfi: number,
  kp: number,
  solarZenithDeg: number,
  geomagLatDeg: number,
): LayerState[] {
  const foF2 = critF2Base(sfi, solarZenithDeg) * kpFactor(kp, geomagLatDeg);
  const f2VirtualHeightKm =
    solarZenithDeg >= F2_NIGHT_ZENITH_THRESHOLD_DEG
      ? F2_VIRTUAL_HEIGHT_KM_NIGHT
      : F2_VIRTUAL_HEIGHT_KM_DAY;

  return [
    { id: 'D', virtualHeightKm: D_VIRTUAL_HEIGHT_KM, criticalFrequencyMhz: null },
    {
      id: 'E',
      virtualHeightKm: E_VIRTUAL_HEIGHT_KM,
      criticalFrequencyMhz: critE(sfi, solarZenithDeg),
    },
    {
      id: 'F1',
      virtualHeightKm: F1_VIRTUAL_HEIGHT_KM,
      criticalFrequencyMhz: critF1(sfi, solarZenithDeg),
    },
    { id: 'F2', virtualHeightKm: f2VirtualHeightKm, criticalFrequencyMhz: foF2 },
  ];
}
