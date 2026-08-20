/**
 * Pure target resolution logic (F10.1, [#76]) for `TargetPicker.tsx` —
 * extracted so it's testable without rendering. Ported in shape from
 * Codeplug Studio's `SlicePlanePicker.tsx` (`resolveSlicePlane`), with a
 * `'coordinates'` mode instead of Studio's `'bearing'` mode — a target is
 * a point, not a bearing/range pair (that's what Studio's own *slice
 * plane* concept resolves for a cross-section direction, not what this
 * product's Target needs).
 *
 * Returns `Target` directly (`@app/state/viewerState`'s own shape, the
 * same one Reach's F5.5 cell-click already writes to
 * `ViewerState.target`) rather than a separate `ResolvedTarget` type —
 * reconciling with F5.5's shape from the start rather than maintaining
 * two incompatible target shapes (F10.4's own instruction).
 *
 * [#76]: https://github.com/pskillen/rf-propagation/issues/76
 */
import { isValidLocator, locatorToCoords } from '@core/domain/maidenhead';
import type { Target } from '../../state/viewerState.tsx';

export type TargetPickMode = 'coordinates' | 'locator' | 'address';

export interface ResolveTargetArgs {
  mode: TargetPickMode;
  /** `'coordinates'` mode's two numeric fields — validated to real ranges (±90/±180). */
  manualLat: number;
  manualLon: number;
  /** `'locator'` mode's raw text field. */
  locatorInput: string;
  /** `'address'` mode's already-geocoded result, or `null` before a lookup resolves. */
  geocodedCoords: { lat: number; lon: number } | null;
  geocodedLabel: string | null;
}

function isValidLat(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function isValidLon(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

/**
 * Resolves the current mode's input into a `Target`, or `null` when that
 * mode's input isn't yet resolvable (empty/invalid) — never throws, and
 * never falls back to a different mode's stale data (a failed geocode in
 * `'address'` mode must not leave a stale resolved target from a
 * previous successful lookup, since `geocodedCoords` is the caller's own
 * state, cleared on failure before this function is ever called again).
 */
export function resolveTarget(args: ResolveTargetArgs): Target | null {
  switch (args.mode) {
    case 'coordinates': {
      if (!isValidLat(args.manualLat) || !isValidLon(args.manualLon)) return null;
      return { lat: args.manualLat, lon: args.manualLon, source: 'coordinates' };
    }
    case 'locator': {
      const trimmed = args.locatorInput.trim();
      if (!isValidLocator(trimmed)) return null;
      const coords = locatorToCoords(trimmed);
      if (!coords) return null;
      return { lat: coords.lat, lon: coords.lon, source: 'locator' };
    }
    case 'address': {
      if (!args.geocodedCoords) return null;
      return {
        lat: args.geocodedCoords.lat,
        lon: args.geocodedCoords.lon,
        label: args.geocodedLabel ?? undefined,
        source: 'address',
      };
    }
  }
}
