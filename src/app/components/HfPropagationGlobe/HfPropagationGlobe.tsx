/**
 * 3D propagation globe (F6, phase 9) — ionospheric shells via
 * `customThreeObject`, the coverage grid as a ground-shading texture
 * (Slice 3), a day/night terminator ring + sun marker (Slice 1), and a
 * transmitter marker (`pointsData`). Ported (reduced) from Codeplug
 * Studio's `HfPropagationGlobe.tsx` — see `buildGlobeData.ts`'s own doc
 * comment for exactly what this phase's port drops (rays, skip-zone ring,
 * ray corridor, per-layer visibility toggles — none of Slice 2's four
 * controls need them) and adds (the coverage ground-shading mesh).
 *
 * Always lazy-loaded by callers (`lazy(() => import('./HfPropagationGlobe.tsx'))`)
 * so map-first surfaces never download the `three`/`react-globe.gl` bundle —
 * see this component's sidecar doc, `HfPropagationGlobe.md`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import type * as THREE from 'three';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import type { LayerState } from '@core/domain/propagation/layers';
import {
  computeSolarTerminator,
  computeSubsolarPoint,
} from '@core/domain/propagation/solarTerminator';
import {
  applyShellClippingPlanes,
  buildCoverageGroundMesh,
  buildCutawayClippingPlane,
  buildNightShadeMesh,
  buildRayPaths,
  buildShellMesh,
  buildSunMarkerMesh,
  buildTerminatorPaths,
  canonicalLayerIndex,
  isCoverageGroundLayer,
  isNightShadeLayer,
  isRayGlobePath,
  isSunMarkerLayer,
  updateCoverageGroundMesh,
  updateShellFresnel,
  type CoverageGroundLayer,
  type GlobePath,
  type NightShadeLayer,
  type RenderedRay,
  type ShellDisplayOptions,
  type SunMarkerLayer,
  type TerminatorPath,
} from './buildGlobeData.ts';
import { TERMINATOR_DASH_GAP, TERMINATOR_DASH_LENGTH } from './globePathDash.ts';
import { applyViewportOffset, computeViewportOffsetPx } from './viewportOffset.ts';
import classes from './HfPropagationGlobe.module.css';

export {
  buildShellMesh,
  displayShellRadiusUnits,
  GLOBE_RADIUS_UNITS,
  shellRadiusUnits,
} from './buildGlobeData.ts';
export type { ShellDisplayOptions } from './buildGlobeData.ts';

const GLOBE_IMAGE_URL = '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';
const BACKGROUND_COLOR = '#000011';
const TRANSMITTER_COLOR = '#4d7cff';

export interface HfPropagationGlobeProps {
  layers: LayerState[];
  display: ShellDisplayOptions;
  /** Instant used for the greyline / night-side overlay (`Conditions.atMs`, already throttled by the caller). Omit to render the shells with no day/night input at all. */
  environmentAtMs?: number;
  /** Dashed terminator ring + sun marker. Night-side shade stays on regardless, whenever `environmentAtMs` is set. Default off. */
  terminatorEnabled?: boolean;
  /** Transmitter WGS84 latitude (degrees). */
  txLat: number;
  /** Transmitter WGS84 longitude (degrees). */
  txLon: number;
  /** Coverage grid to shade as ground texture (F6.3) — `null` before the first response, same as Reach's 2D map. */
  coverageResult: CoverageGridResult | null;
  /** Clip shells along the slice-plane bearing. Default off. */
  cutawayEnabled?: boolean;
  /** Slice-plane bearing (degrees true). Default 0 (the active antenna's heading when directional, per this phase's plan file). */
  sliceBearingDeg?: number;
  /** Illustration-ray overlay (F8.2, phase 11) — already coloured/filtered/soloed by the caller; this component only draws them. Default none. */
  rays?: RenderedRay[];
}

type CustomLayerEntry =
  | (LayerState & Partial<{ sunLatDeg: number; sunLonDeg: number }>)
  | NightShadeLayer
  | SunMarkerLayer
  | CoverageGroundLayer;

function pathColor(path: object): string {
  return (path as TerminatorPath).color;
}

function pathDashLength(path: object): number {
  return isRayGlobePath(path) ? path.dashLengthFraction : TERMINATOR_DASH_LENGTH;
}

function pathDashGap(path: object): number {
  return isRayGlobePath(path) ? path.dashGapFraction : TERMINATOR_DASH_GAP;
}

export default function HfPropagationGlobe({
  layers,
  display,
  environmentAtMs,
  terminatorEnabled = false,
  txLat,
  txLon,
  coverageResult,
  cutawayEnabled = false,
  sliceBearingDeg = 0,
  rays,
}: HfPropagationGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const fresnelEnabledRef = useRef(display.fresnelEnabled);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // All four shells are always drawn (Slice 1's own instruction) — the
  // spatial day/night fade (shellPresence, in the shader) is what makes
  // D/F1 actually fade out at night, not an operator-hide filter (this
  // phase has no per-layer visibility toggle — Slice 2's four controls
  // don't include one).
  const visibleShells = useMemo(
    () => layers.slice().sort((a, b) => canonicalLayerIndex(a.id) - canonicalLayerIndex(b.id)),
    [layers],
  );

  const cutawayPlanes = useMemo(
    () => (cutawayEnabled ? [buildCutawayClippingPlane(txLat, txLon, sliceBearingDeg)] : []),
    [cutawayEnabled, txLat, txLon, sliceBearingDeg],
  );
  const cutawayPlanesRef = useRef(cutawayPlanes);
  useEffect(() => {
    cutawayPlanesRef.current = cutawayPlanes;
  }, [cutawayPlanes]);

  const subsolar = useMemo(() => {
    if (environmentAtMs == null) return null;
    const point = computeSubsolarPoint(environmentAtMs);
    return { sunLatDeg: point.latDeg, sunLonDeg: point.lonDeg };
  }, [environmentAtMs]);

  const terminatorPaths = useMemo(() => {
    if (!terminatorEnabled || environmentAtMs == null) return [];
    return buildTerminatorPaths(computeSolarTerminator(environmentAtMs));
  }, [terminatorEnabled, environmentAtMs]);

  // F8.2 (phase 11) -- rays render on both the cross-section AND the globe
  // from the SAME `IllustrationRay[]` the caller already generated once;
  // this component only converts each ray into a drawable path, it never
  // calls `generateIllustrationRays` itself.
  const rayPaths = useMemo(
    () => buildRayPaths(rays ?? [], display.exaggerationFactor),
    [rays, display.exaggerationFactor],
  );

  const allPaths = useMemo<GlobePath[]>(
    () => [...terminatorPaths, ...rayPaths],
    [terminatorPaths, rayPaths],
  );

  const points = useMemo(
    () => [{ kind: 'transmitter' as const, lat: txLat, lng: txLon, color: TRANSMITTER_COLOR }],
    [txLat, txLon],
  );

  const customLayerData = useMemo(() => {
    const objects: CustomLayerEntry[] = visibleShells.map((layer) =>
      subsolar ? { ...layer, sunLatDeg: subsolar.sunLatDeg, sunLonDeg: subsolar.sunLonDeg } : layer,
    );
    if (subsolar) {
      objects.push({
        kind: 'night-shade',
        sunLatDeg: subsolar.sunLatDeg,
        sunLonDeg: subsolar.sunLonDeg,
      });
      if (terminatorEnabled) {
        objects.push({ kind: 'sun', sunLatDeg: subsolar.sunLatDeg, sunLonDeg: subsolar.sunLonDeg });
      }
    }
    if (coverageResult) {
      // Always at the SAME array index (last) across renders — react-globe.gl
      // (via three-globe's d3-style data join) tracks customLayerData entries
      // by position, so as long as this entry stays last, customThreeObjectUpdate
      // (not customThreeObject) runs on every new coarse/fine grid result,
      // keeping this "one mesh, one texture, updated in place" (F6.3's own AC).
      objects.push({ kind: 'coverage-ground', result: coverageResult, txLat, txLon });
    }
    return objects;
  }, [visibleShells, subsolar, terminatorEnabled, coverageResult, txLat, txLon]);

  useEffect(() => {
    fresnelEnabledRef.current = display.fresnelEnabled;
  }, [display.fresnelEnabled]);

  const shellObjectAccessor = useMemo(
    () => (d: object) => {
      if (isNightShadeLayer(d)) return buildNightShadeMesh(d);
      if (isSunMarkerLayer(d)) return buildSunMarkerMesh(d);
      if (isCoverageGroundLayer(d)) return buildCoverageGroundMesh(d);
      const layer = d as LayerState;
      const mesh = buildShellMesh(d, canonicalLayerIndex(layer.id), display);
      applyShellClippingPlanes(mesh, cutawayPlanesRef.current);
      return mesh;
    },
    [display],
  );

  // Verified against react-globe.gl 2.x (see buildGlobeData.ts's own note,
  // ported from the reference component): customThreeObjectUpdate runs on
  // every custom-layer *data* change (create AND update), not once per
  // animation frame — used here both to keep the coverage-ground mesh's
  // texture current (updateCoverageGroundMesh, a no-op for any other
  // object type) and, via a live rAF loop below, to push Fresnel/cutaway
  // state (which needs a live camera position) into each shell shader.
  const dataUpdateAccessor = useMemo(
    () => (obj: THREE.Object3D, d: object) => {
      updateCoverageGroundMesh(obj, d);
      const camera = globeRef.current?.camera() as THREE.Camera | undefined;
      updateShellFresnel(obj, camera, fresnelEnabledRef.current);
    },
    [],
  );

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const globe = globeRef.current;
      const camera = globe?.camera() as THREE.Camera | undefined;
      const scene = globe?.scene();
      if (camera && scene) {
        const renderer = globe?.renderer();
        if (renderer) renderer.localClippingEnabled = true;
        scene.traverse((obj) => {
          updateShellFresnel(obj, camera, fresnelEnabledRef.current);
          applyShellClippingPlanes(obj, cutawayPlanesRef.current);
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    const renderer = globe?.renderer();
    if (renderer) renderer.localClippingEnabled = true;
    const scene = globe?.scene();
    if (!scene) return;
    scene.traverse((obj) => applyShellClippingPlanes(obj, cutawayPlanes));
  }, [cutawayPlanes, size.width, size.height, customLayerData]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, []);

  // Slice 4 (F6.4) -- viewport offset, recomputed inside the SAME resize
  // signal that already drives `size` above (not a second ResizeObserver),
  // so it holds across window resizes and collapses to 0 below the mobile
  // breakpoint, per this phase's own AC. See viewportOffset.ts for the
  // shift-direction judgment call.
  useEffect(() => {
    const camera = globeRef.current?.camera() as THREE.PerspectiveCamera | undefined;
    if (!camera) return;
    const shiftPx = computeViewportOffsetPx(size.width);
    applyViewportOffset(camera, size.width, size.height, shiftPx);
  }, [size.width, size.height]);

  return (
    <div className={classes.wrapper} ref={containerRef}>
      <Globe
        ref={globeRef}
        globeImageUrl={GLOBE_IMAGE_URL}
        backgroundColor={BACKGROUND_COLOR}
        showAtmosphere
        width={size.width || undefined}
        height={size.height || undefined}
        customLayerData={customLayerData}
        customThreeObject={shellObjectAccessor}
        customThreeObjectUpdate={dataUpdateAccessor}
        pathsData={allPaths}
        pathPoints="points"
        pathPointLat={(p: unknown) => (p as [number, number, number])[0]}
        pathPointLng={(p: unknown) => (p as [number, number, number])[1]}
        pathPointAlt={(p: unknown) => (p as [number, number, number])[2]}
        pathColor={pathColor}
        pathDashLength={pathDashLength}
        pathDashGap={pathDashGap}
        pathDashAnimateTime={0}
        pathStroke={3.6}
        pathTransitionDuration={0}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => TRANSMITTER_COLOR}
        pointRadius={0.35}
        pointAltitude={0}
        pointsTransitionDuration={0}
      />
    </div>
  );
}
