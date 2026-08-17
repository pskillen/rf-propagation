/**
 * Reflection selection: given a frequency, takeoff angle and the current
 * layer states, decide which layer (if any) reflects the wave.
 *
 * The wave meets layers in ascending height order — E, then F1, then F2 —
 * and reflects off the first one whose MUF (critical frequency x sec(phi))
 * is at or above the operating frequency. If none qualifies, it escapes.
 */

import { incidenceAngleRad } from './geometry';
import type { LayerId, LayerState } from './layers';

export type ReflectionResult =
  { kind: 'reflected'; layer: LayerId; mufMhz: number } | { kind: 'escaped' };

/**
 * Layers eligible for reflection, in the order a wave meets them (ascending
 * virtual height). D is deliberately absent from this list — not skipped by
 * a runtime condition, but structurally impossible to select, since
 * selectReflectingLayer only ever looks up these three ids from its input.
 * This is the single most important line in this module: it is what V6
 * (validation.test.ts) exists to catch a regression in.
 */
const REFLECTING_LAYER_IDS: readonly LayerId[] = ['E', 'F1', 'F2'];

/**
 * MUF factor sec(phi) for a layer at the given virtual height and takeoff
 * angle. Bounded by spherical geometry (geometry.ts's incidenceAngleRad),
 * unlike mk1's unbounded 1/sin(Delta) flat-Earth factor.
 */
export function mufFactor(takeoffAngleRad: number, virtualHeightKm: number): number {
  const phi = incidenceAngleRad(takeoffAngleRad, virtualHeightKm);
  return 1 / Math.cos(phi);
}

/**
 * Selects the first reflecting layer (E, then F1, then F2 — never D) whose
 * MUF is at or above `frequencyMhz`, or reports that the ray escapes to
 * space if none qualifies. LUF is not computed here — it is emergent from
 * the phase-3 link budget, not a property of reflection geometry alone.
 */
export function selectReflectingLayer(
  frequencyMhz: number,
  takeoffAngleRad: number,
  layers: LayerState[],
): ReflectionResult {
  for (const id of REFLECTING_LAYER_IDS) {
    const layer = layers.find((candidate) => candidate.id === id);
    if (!layer || layer.criticalFrequencyMhz == null) continue;

    const mufMhz = layer.criticalFrequencyMhz * mufFactor(takeoffAngleRad, layer.virtualHeightKm);
    if (frequencyMhz <= mufMhz) {
      return { kind: 'reflected', layer: layer.id, mufMhz };
    }
  }
  return { kind: 'escaped' };
}
