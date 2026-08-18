/**
 * Pure layer-band extraction for `VerticalCrossSection` (F8.1, phase 11's
 * Slice 1) — which of D/E/F1/F2's `LayerState`s are actually "up there"
 * right now, so the diagram can draw a background band only for an active
 * layer (F1 visibly disappearing at night, per `layerStates`' own day/night
 * behaviour).
 *
 * JUDGMENT CALL, FLAGGED: the plan file's own suggested signature is
 * `crossSectionLayerBands(layers: LayerState[])`, filtering on
 * `criticalFrequencyMhz !== null` alone. That works for E/F1/F2 (E and F2
 * are never null; F1 is null exactly at night, per `layers.ts`'
 * `critF1`), but D's `criticalFrequencyMhz` is **always** `null` — D is
 * never a reflection candidate (`layers.ts`'s own doc: "D has no critical
 * frequency at all"), so a bare `criticalFrequencyMhz !== null` filter
 * would never draw the D band at all, at any time of day, which is not
 * what "F1/D visibly disappear at the right times" (this phase's own
 * acceptance criterion) means for D specifically. D is instead gated on
 * `solarZenithDeg < 90` directly — the same "is the sun up" boundary
 * `losses.ts`'s `ionosphericAbsorptionDbPerHop` uses to zero out
 * D-layer absorption at night (`chiTerm`), since D's real-world presence
 * is a daylight-photoionisation phenomenon this model represents through
 * absorption, not through a critical frequency.
 */
import type { LayerId, LayerState } from '@core/domain/propagation/layers';

export interface CrossSectionLayerBand {
  layer: LayerId;
  heightKm: number;
}

/** Solar zenith angle (deg) at/above which D-layer photoionisation is treated as absent — mirrors `losses.ts`'s own `chiTerm` cutover. */
const D_LAYER_NIGHT_ZENITH_THRESHOLD_DEG = 90;

export function crossSectionLayerBands(
  layers: LayerState[],
  solarZenithDeg: number,
): CrossSectionLayerBand[] {
  return layers
    .filter((layer) =>
      layer.id === 'D'
        ? solarZenithDeg < D_LAYER_NIGHT_ZENITH_THRESHOLD_DEG
        : layer.criticalFrequencyMhz !== null,
    )
    .map((layer) => ({ layer: layer.id, heightKm: layer.virtualHeightKm }));
}
