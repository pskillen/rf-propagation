/**
 * D/E/F1/F2 shell colours — ported from Codeplug Studio's
 * `src/core/domain/hfPropagation/layerColor.ts` (phase 9's plan file,
 * "Reference-only source"), verbatim palette, adapted from mk1's
 * `IonosphericLayerId` to this repo's own `LayerId`
 * (`@core/domain/propagation/layers`). Not a physics module — a rendering
 * constant only the globe (and later, any other layer visualisation) needs
 * — kept under `propagation/` alongside `layers.ts` rather than a
 * `hfPropagation/` directory this repo doesn't have.
 */
import type { LayerId } from './layers';

/** Canonical inner→outer order — explode offsets and visibility toggles use this, not filtered array index. */
export const LAYER_IDS_INNER_TO_OUTER: readonly LayerId[] = ['D', 'E', 'F1', 'F2'];

const LAYER_COLORS: Record<LayerId, string> = {
  // Inner→outer warm→cool so D contrasts against the blue-marble globe.
  D: '#ff6b6b',
  E: '#f5c451',
  F1: '#3ddc97',
  F2: '#5ec8ff',
};

/** Shared D/E/F1/F2 shell colours for the globe (and any future layer visualisation). */
export function colorForLayer(id: LayerId): string {
  return LAYER_COLORS[id];
}
