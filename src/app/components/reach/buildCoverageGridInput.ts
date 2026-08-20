/**
 * Assembles a `CoverageGridInput` (phase 4's public entry point,
 * `@core/domain/propagation/coverageGrid`) from Station + Conditions +
 * a frequency — the one place Reach turns "what the operator has
 * configured" into "what the engine needs." App-layer-owned: this phase
 * adds no engine code (per its own plan's "Physics/engine invariant
 * note"), it only calls the public API phase 4 built.
 *
 * Lives alongside Reach's other components rather than under
 * `src/app/lib/` — a `src/app/lib/coverage/` directory would collide with
 * `.gitignore`'s `coverage/` pattern (the test-coverage-report
 * convention), silently hiding this whole module from `git status`/`git
 * add`. Reach is the only consumer so far; move it if a later phase needs
 * the same builder from outside this component folder.
 */
import { layerStates, type LayerState } from '@core/domain/propagation/layers';
import { solarZenithAngleDeg } from '@core/domain/propagation/solarZenithAngle';
import { ssnFromSfi } from '@core/domain/propagation/losses';
import type { CoverageGridInput } from '@core/domain/propagation/coverageGrid';
import type { Station } from '@core/domain/station/types';
import type { Conditions } from '@core/domain/conditions/types';

/**
 * Receiver bandwidth (Hz) fed to the engine — matches
 * `coverageGrid.ts`'s own internal `REFERENCE_MODE = 'ssb'` convention and
 * the 2400 Hz value every existing test fixture in this repo already uses
 * for the same reason (phase 3's `LinkBudgetInput.bandwidthHz` doc:
 * "2400 for the standard mode set").
 */
const REFERENCE_BANDWIDTH_HZ = 2400;

/**
 * Simple dipole approximation of geomagnetic latitude — JUDGMENT CALL,
 * FLAGGED, in the same spirit as phase 4's own groundwave-range/
 * reference-mode calls: no module in this repo computes geomagnetic
 * latitude yet (`layerStates`'s `geomagLatDeg` parameter has only ever
 * been fed literal test constants — see `layers.test.ts`), and this is
 * the first real caller that needs a value derived from an actual station
 * location. Standard first-order dipole-tilt approximation using a fixed
 * north-geomagnetic-pole location (~80.7degN, 72.7degW, a commonly-cited
 * present-epoch value) — adequate for `layerStates`'s `kpFactor` role as a
 * coarse latitude-band modifier on F2 critical frequency, not a full
 * IGRF/AACGM model. Kept in the app layer rather than
 * `src/core/domain/propagation/` per this phase's own "adds no engine
 * code" invariant; promote into core if a later phase needs the same
 * approximation for engine purposes.
 */
const GEOMAG_POLE_LAT_DEG = 80.7;
const GEOMAG_POLE_LON_DEG = -72.7;

function approximateGeomagLatDeg(latDeg: number, lonDeg: number): number {
  const toRad = Math.PI / 180;
  const latPoleRad = GEOMAG_POLE_LAT_DEG * toRad;
  const latRad = latDeg * toRad;
  const dLonRad = (lonDeg - GEOMAG_POLE_LON_DEG) * toRad;

  const sinGeomagLat =
    Math.sin(latPoleRad) * Math.sin(latRad) +
    Math.cos(latPoleRad) * Math.cos(latRad) * Math.cos(dLonRad);
  return Math.asin(Math.max(-1, Math.min(1, sinGeomagLat))) * (180 / Math.PI);
}

/**
 * `layerStates()` for a given point + Conditions -- pulled out of
 * `buildCoverageGridInput` so the globe (phase 9, Slice 1) can compute the
 * SAME `LayerState[]` its shells render without duplicating the
 * geomagnetic-latitude approximation above, or depending on the full
 * `CoverageGridInput` shape it does not otherwise need.
 */
export function computeLayerStates(
  qth: { lat: number; lon: number },
  conditions: Conditions,
): LayerState[] {
  const solarZenithDeg = solarZenithAngleDeg(qth.lat, qth.lon, conditions.atMs);
  const geomagLatDeg = approximateGeomagLatDeg(qth.lat, qth.lon);
  return layerStates(conditions.driver.sfi, conditions.driver.kp, solarZenithDeg, geomagLatDeg);
}

/**
 * Builds a `CoverageGridInput` for `station`/`conditions`/`frequencyMhz`,
 * at `qth` (defaults to `station.qth` — an explicit override lets a
 * live marker-drag recompute at the pointer's current position without
 * waiting for `station.qth` itself to be committed, per Slice 1/2's
 * "drag animates, dragend persists" split).
 */
export function buildCoverageGridInput(
  station: Station,
  conditions: Conditions,
  frequencyMhz: number,
  qth: { lat: number; lon: number } = station.qth,
): CoverageGridInput {
  const activeAntenna =
    station.antennas.find((antenna) => antenna.id === station.activeAntennaId) ??
    station.antennas[0];

  return {
    txLat: qth.lat,
    txLon: qth.lon,
    atMs: conditions.atMs,
    frequencyMhz,
    layers: computeLayerStates(qth, conditions),
    ssn: ssnFromSfi(conditions.driver.sfi),
    txPowerW: station.powerW,
    // Slice 1 (fix/reach-directionality-antenna-greyline): the whole TX
    // antenna, not just its flat gainDbi -- the coverage grid now shapes
    // gain by elevation/azimuth per cell (coverageGrid.ts).
    txAntenna: activeAntenna,
    // Symmetric reference receiver (phase 3's own LinkBudgetInput doc):
    // same antenna gain as TX until a real antenna-pattern lookup exists.
    // Still a flat number -- Slice 1 is scoped to the TX side only.
    rxAntennaGainDbi: activeAntenna.gainDbi,
    groundType: conditions.ground,
    noiseEnvironment: station.noiseEnvironment,
    bandwidthHz: REFERENCE_BANDWIDTH_HZ,
  };
}
