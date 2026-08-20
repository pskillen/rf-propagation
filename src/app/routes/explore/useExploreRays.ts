/**
 * The single `generateIllustrationRays` call this phase's own invariant
 * demands (F8.2's "rays render on the cross-section and on the globe" —
 * from ONE call, not two slightly-different ones) — `ExplorePage` calls
 * this once per `display`/station/conditions/target change and passes the
 * same `IllustrationRay[]` to both `VerticalCrossSection` and the globe's
 * ray overlay.
 *
 * `mode: 'rose'` (360deg tiling) when `target` is null; `mode: 'fan'` with
 * `focusBearingDeg` computed from the target's bearing when set — a
 * preview of F10.4's behaviour (Path, phase 13, is what actually flips the
 * surface, but Explore's own ray mode already tracks `target` correctly
 * since it reads the same shared `ViewerState`).
 */
import { useMemo } from 'react';
import type { CoverageGridInput } from '@core/domain/propagation/coverageGrid';
import {
  generateIllustrationRays,
  type IllustrationRay,
} from '@core/domain/propagation/illustrationRays';
import { initialBearingDeg } from '../../lib/geo/bearingDistance.ts';
import type { RayControlsState } from '../../state/rayControls.ts';
import type { Target } from '../../state/viewerState.tsx';

/**
 * Angular width (degrees) of the fan tiled around the target's bearing —
 * a rendering judgment call, not a spec value: wide enough that a handful
 * of radials either side of the direct path are still visible (useful
 * context for "how much does drifting off bearing change the picture"),
 * narrow enough that the fan still reads as "pointed at the target."
 */
const FOCUS_WIDTH_DEG = 30;

export function currentBearingDeg(
  qth: { lat: number; lon: number },
  target: Target | null,
  manualBearingDeg: number,
): number {
  if (!target) return manualBearingDeg;
  return initialBearingDeg(
    { latDeg: qth.lat, lonDeg: qth.lon },
    { latDeg: target.lat, lonDeg: target.lon },
  );
}

export function useExploreRays(
  context: CoverageGridInput,
  rayControls: RayControlsState,
  target: Target | null,
): IllustrationRay[] {
  const bearingDeg = currentBearingDeg(
    { lat: context.txLat, lon: context.txLon },
    target,
    rayControls.focusBearingDeg,
  );
  const { radials, elevations, elevationSpreadDeg } = rayControls;
  const elevationMinDeg = elevationSpreadDeg[0];
  const elevationMaxDeg = elevationSpreadDeg[1];

  return useMemo(() => {
    const spread: [number, number] = [elevationMinDeg, elevationMaxDeg];
    if (target) {
      return generateIllustrationRays(
        {
          radialCount: radials,
          elevationCount: elevations,
          elevationSpreadDeg: spread,
          mode: 'fan',
          focusBearingDeg: bearingDeg,
          focusWidthDeg: FOCUS_WIDTH_DEG,
        },
        context,
      );
    }
    return generateIllustrationRays(
      {
        radialCount: radials,
        elevationCount: elevations,
        elevationSpreadDeg: spread,
        mode: 'rose',
      },
      context,
    );
  }, [context, radials, elevations, elevationMinDeg, elevationMaxDeg, target, bearingDeg]);
}

/**
 * The ray this bearing's cross-section polyline (Slice 1) reuses, rather
 * than requesting a second `generateIllustrationRays` call for the
 * "primary" hop sequence — the ray whose azimuth is closest to the
 * current bearing, breaking ties by the elevation closest to the middle
 * of `elevationSpreadDeg`.
 */
export function selectPrimaryRay(
  rays: IllustrationRay[],
  bearingDeg: number,
  elevationSpreadDeg: [number, number],
): IllustrationRay | null {
  if (rays.length === 0) return null;
  const midElevationDeg = (elevationSpreadDeg[0] + elevationSpreadDeg[1]) / 2;
  let best = rays[0]!;
  let bestScore = Infinity;
  for (const ray of rays) {
    const azimuthDiff = Math.min(
      Math.abs(ray.azimuthDeg - bearingDeg),
      360 - Math.abs(ray.azimuthDeg - bearingDeg),
    );
    const elevationDiff = Math.abs(ray.elevationDeg - midElevationDeg);
    const score = azimuthDiff * 100 + elevationDiff;
    if (score < bestScore) {
      bestScore = score;
      best = ray;
    }
  }
  return best;
}
