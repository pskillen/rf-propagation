/**
 * Globe mesh/shader/geometry math — ported (reduced) from Codeplug
 * Studio's `src/app/components/HfPropagationGlobe/buildGlobeData.ts`
 * (phase 9's plan file, "Reference-only source"), adapted to this repo's
 * `LayerState` (`@core/domain/propagation/layers`, one `virtualHeightKm`
 * per layer, no `active` flag, no altitude band) instead of mk1's
 * `IonosphericLayerState` (`active` + `altitudeMinKm`/`altitudeMaxKm`).
 *
 * Reduced scope vs. the reference file (phase 9's own "does NOT do" list):
 * no rays (`rayResultsToGlobePaths`/`buildRayCorridorMesh`), no skip-zone
 * ring (`buildSkipZonePaths`), no `MODE_COLORS`/`MODE_LABELS`/
 * `PROPAGATION_MODES` (this repo has no `PropagationMode` type surfaced to
 * the app layer yet — illustration rays are phase 11's job). Adds Slice
 * 3's coverage ground-shading texture, which the reference file has no
 * equivalent of (mk1 never rendered the dense coverage grid on its globe).
 *
 * JUDGMENT CALL, FLAGGED: the reference file spatially varies each
 * shell's RADIUS between a day and a night mid-altitude
 * (`layerMidAltitudeKm(id, isNight)`, a function this repo has no
 * equivalent of) so F2 visibly drops into F1's band on the night
 * hemisphere. This repo's `LayerState.virtualHeightKm` is a single
 * number — one "uniform ionosphere" snapshot evaluated once at the
 * station for the current Conditions (see `coverageGrid.ts`'s own header:
 * "layers is ONE evaluation at the station... not re-evaluated per hop"),
 * not two engine-exported day/night altitude constants per layer.
 * Inventing a second, spatially-varying altitude model outside the engine
 * would be in tension with this phase's "no engine code changes"
 * invariant, so shell RADIUS here reflects the current Conditions
 * snapshot uniformly across the whole globe; only per-fragment
 * OPACITY/presence fades with local sun angle (`shellPresence` /
 * `dLayerPresence` / `dayNightFactor` below, ported verbatim — these are
 * pure cosmetic geometry, not physics, so they port unchanged). D and F1
 * still visibly fade out on the night hemisphere, per F6.1's own AC; only
 * the "F2 shrinks at night" radius effect is dropped.
 */
import * as THREE from 'three';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import type { GeoPoint } from '@core/domain/propagation/greatCircle';
import type { LayerId, LayerState } from '@core/domain/propagation/layers';
import { colorForLayer, LAYER_IDS_INNER_TO_OUTER } from '@core/domain/propagation/layerColor';
import { cutawayPlaneNormal, latLonToGlobeCartesian } from '@core/domain/propagation/cutawayPlane';
import { cellFillStyle } from '../reach/cellFillStyle.ts';
import { altitudeKmToGlobeRadiusUnits } from './globeAltitude.ts';

/**
 * `three-globe`'s own internal scene-unit radius for the globe mesh
 * (pinned copy of `GLOBE_RADIUS` in `three-globe`'s source — not exported
 * from the package). `customThreeObject` positions/sizes objects in these
 * same scene units, not the `0`-`1`+ altitude units `react-globe.gl`'s own
 * `pointAltitude`/`pathPointAlt` accessors use.
 */
export const GLOBE_RADIUS_UNITS = 100;

/** D/E sit only a few percent above the globe mesh — bump so they remain readable when isolated. */
export const SHELL_INNER_BASELINE_OPACITY = 0.28;

/** Canonical D=0 ... F2=3 index for explode offsets, independent of which shells are currently drawn. */
export function canonicalLayerIndex(id: LayerId): number {
  const index = LAYER_IDS_INNER_TO_OUTER.indexOf(id);
  return index < 0 ? 0 : index;
}

/** Opacity drop per canonical layer index (D=0 ... F2=3) so outer shells stay slightly thinner. */
export const SHELL_OPACITY_STEP = 0.05;

export function shellBaselineOpacity(layerIndex: number): number {
  const index = layerIndex < 0 ? 0 : layerIndex;
  return Math.max(0, SHELL_INNER_BASELINE_OPACITY - index * SHELL_OPACITY_STEP);
}

/** Extra radial separation per layer when exploded stacking is on, in globe-radius units. */
export const EXPLODE_OFFSET_PER_LAYER = 0.15;

export interface ShellDisplayOptions {
  exaggerationFactor: number;
  explodeEnabled: boolean;
  fresnelEnabled: boolean;
}

/** Face-on (looking through the shell toward Earth) opacity when Fresnel shading is on. */
export const FRESNEL_OPACITY_MIN = 0.05;
/** Grazing/limb opacity when Fresnel shading is on. */
export const FRESNEL_OPACITY_MAX = 0.4;
/** `pow(1 - |N.V|, power)` — higher tightens the glow to the silhouette rim. */
export const FRESNEL_POWER = 2;

/**
 * Exaggerates an altitude for display purposes only — physics/positioning
 * elsewhere in the app must keep using the real altitudeKm. Factor <= 1
 * is a no-op.
 */
export function exaggeratedAltitudeKm(altitudeKm: number, factor: number): number {
  if (!Number.isFinite(factor) || factor <= 1) return altitudeKm;
  return altitudeKm * factor;
}

/**
 * Additional radial separation (in the same globe-radius units
 * `altitudeKmToGlobeRadiusUnits` produces) for exploded-layer-stacking
 * mode, keyed by layer index (0 = D, 1 = E, 2 = F1, 3 = F2) so lower
 * layers get less separation than higher ones and the stack still reads
 * bottom-up.
 */
export function explodeOffsetUnits(layerIndex: number, enabled: boolean): number {
  if (!enabled) return 0;
  return layerIndex * EXPLODE_OFFSET_PER_LAYER;
}

/**
 * Scene-unit radius for a shell after display-only exaggeration and
 * explode offset. Separated from `THREE.Mesh` instantiation so the math
 * stays unit-testable.
 */
export function displayShellRadiusUnits(
  virtualHeightKm: number,
  layerIndex: number,
  display: ShellDisplayOptions,
): number {
  const displayAltitudeKm = exaggeratedAltitudeKm(virtualHeightKm, display.exaggerationFactor);
  const index = layerIndex < 0 ? 0 : layerIndex;
  return (
    (1 +
      altitudeKmToGlobeRadiusUnits(displayAltitudeKm) +
      explodeOffsetUnits(index, display.explodeEnabled)) *
    GLOBE_RADIUS_UNITS
  );
}

/**
 * Converts a shell's virtual height (km above the surface) to a
 * `customThreeObject` scene-unit radius at true scale (no exaggeration,
 * no explode).
 */
export function shellRadiusUnits(virtualHeightKm: number): number {
  return displayShellRadiusUnits(virtualHeightKm, 0, {
    exaggerationFactor: 1,
    explodeEnabled: false,
    fresnelEnabled: false,
  });
}

/** Matches `layers.ts`'s F1 day/night cutover (solar zenith 75deg) as a sun-direction cosine, widened into a smooth dusk band for the shader. */
export const DUSK_NDOT_SUN_LO = Math.cos((100 * Math.PI) / 180);
/** Day side of the dusk band — sun ~10deg above the horizon. */
export const DUSK_NDOT_SUN_HI = Math.cos((80 * Math.PI) / 180);
/** D-layer is gone by the terminator and only fully present well into daylight. */
export const D_THIN_NDOT_SUN_LO = Math.cos((95 * Math.PI) / 180);
export const D_THIN_NDOT_SUN_HI = Math.cos((70 * Math.PI) / 180);

function hermiteSmoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 0 = night hemisphere, 1 = day hemisphere (GLSL `smoothstep` equivalent). */
export function dayNightFactor(ndotSun: number): number {
  return hermiteSmoothstep(DUSK_NDOT_SUN_LO, DUSK_NDOT_SUN_HI, ndotSun);
}

/**
 * Night-side opacity scale. D/F1 vanish; E dims; F2 stays (this repo does
 * not drop F2's radius at night — see this file's own header).
 */
export function shellNightPresence(id: LayerId): number {
  if (id === 'D' || id === 'F1') return 0;
  if (id === 'E') return 0.45;
  return 1;
}

/** Extra D-layer fade so the shell thins along the terminator instead of cutting off. */
export function dLayerPresence(ndotSun: number): number {
  return hermiteSmoothstep(D_THIN_NDOT_SUN_LO, D_THIN_NDOT_SUN_HI, ndotSun);
}

export function shellPresence(id: LayerId, ndotSun: number): number {
  if (id === 'D') return dLayerPresence(ndotSun);
  return shellNightPresence(id) + (1 - shellNightPresence(id)) * dayNightFactor(ndotSun);
}

/** Matches `three-globe` `polar2Cartesian` (unit vector, relAltitude 0). */
export function latLonToGlobeDirection(latDeg: number, lonDeg: number): THREE.Vector3 {
  const { x, y, z } = latLonToGlobeCartesian(latDeg, lonDeg);
  return new THREE.Vector3(x, y, z);
}

export type ShellSunOverlay = {
  sunLatDeg: number;
  sunLonDeg: number;
};

export function isShellSunOverlay(d: object): d is LayerState & ShellSunOverlay {
  const rec = d as LayerState & Partial<ShellSunOverlay>;
  return (
    typeof rec.id === 'string' &&
    typeof rec.sunLatDeg === 'number' &&
    typeof rec.sunLonDeg === 'number'
  );
}

/**
 * Builds one translucent ionospheric shell mesh at a fixed radius (this
 * repo's `LayerState.virtualHeightKm` — see this file's header for why
 * radius does not vary per-fragment). When sun lat/lon are present, the
 * fragment shader fades D/F1/E by local sun angle (`shellPresence`) and
 * applies Fresnel shading; without them the shell renders at its plain
 * baseline opacity (no day/night input yet).
 */
export function buildShellMesh(
  layer: object,
  layerIndex: number,
  display: ShellDisplayOptions,
): THREE.Object3D {
  const s = layer as LayerState;
  const spatial = isShellSunOverlay(layer) ? layer : null;
  const radiusUnits = displayShellRadiusUnits(s.virtualHeightKm, layerIndex, display);
  const geometry = new THREE.SphereGeometry(radiusUnits, 64, 64);
  const baselineOpacity = shellBaselineOpacity(layerIndex);
  const fresnelScale = baselineOpacity / SHELL_INNER_BASELINE_OPACITY;
  const sunDir = spatial
    ? latLonToGlobeDirection(spatial.sunLatDeg, spatial.sunLonDeg)
    : new THREE.Vector3(0, 1, 0);
  const material = new THREE.MeshBasicMaterial({
    color: colorForLayer(s.id),
    transparent: true,
    opacity: baselineOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const uniforms = {
    uFresnelEnabled: { value: display.fresnelEnabled ? 1 : 0 },
    uBaselineOpacity: { value: baselineOpacity },
    uOpacityMin: { value: FRESNEL_OPACITY_MIN * fresnelScale },
    uOpacityMax: { value: FRESNEL_OPACITY_MAX * fresnelScale },
    uFresnelPower: { value: FRESNEL_POWER },
    uSunDir: { value: sunDir },
    uSpatialDayNight: { value: spatial ? 1 : 0 },
    uNightPresence: { value: shellNightPresence(s.id) },
    uDThinning: { value: s.id === 'D' ? 1 : 0 },
    uDuskLo: { value: DUSK_NDOT_SUN_LO },
    uDuskHi: { value: DUSK_NDOT_SUN_HI },
    uDThinLo: { value: D_THIN_NDOT_SUN_LO },
    uDThinHi: { value: D_THIN_NDOT_SUN_HI },
  };
  material.userData.shellFresnelUniforms = uniforms;
  material.customProgramCacheKey = () => 'reach-shell-fresnel-daynight';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec3 vShellWorldPosition;
varying vec3 vShellWorldNormal;
varying float vShellNdotSun;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec3 shellRadial = normalize(position);
       vShellNdotSun = dot(shellRadial, normalize(uSunDir));
       vShellWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
       vShellWorldNormal = normalize(mat3(modelMatrix) * shellRadial);`,
    );
    shader.fragmentShader = `uniform float uFresnelEnabled;
uniform float uBaselineOpacity;
uniform float uOpacityMin;
uniform float uOpacityMax;
uniform float uFresnelPower;
uniform vec3 uSunDir;
uniform float uNightPresence;
uniform float uDThinning;
uniform float uSpatialDayNight;
uniform float uDuskLo;
uniform float uDuskHi;
uniform float uDThinLo;
uniform float uDThinHi;
varying vec3 vShellWorldPosition;
varying vec3 vShellWorldNormal;
varying float vShellNdotSun;
${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
         vec3 shellViewDir = normalize(cameraPosition - vShellWorldPosition);
         float ndotv = abs(dot(normalize(vShellWorldNormal), shellViewDir));
         float fresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), uFresnelPower);
         float fresnelOpacity = mix(uOpacityMin, uOpacityMax, fresnel);
         float baseAlpha = mix(uBaselineOpacity, fresnelOpacity, uFresnelEnabled);
         float dayFactor = smoothstep(uDuskLo, uDuskHi, vShellNdotSun);
         float dPresence = smoothstep(uDThinLo, uDThinHi, vShellNdotSun);
         float duskPresence = mix(uNightPresence, 1.0, dayFactor);
         float presence = mix(duskPresence, dPresence, uDThinning);
         diffuseColor.a = baseAlpha * mix(1.0, presence, uSpatialDayNight);`,
    );
  };
  const mesh = new THREE.Mesh(geometry, material);
  // All shells share the globe origin, so Three's transparent distance-sort is unstable and
  // follows insertion order (last toggled-on shell jumps to the front). Paint outer first,
  // inner last, so D/E are not buried under F1/F2.
  mesh.renderOrder = LAYER_IDS_INNER_TO_OUTER.length - 1 - layerIndex;
  return mesh;
}

/** Pushes the Fresnel toggle into each shell's shader uniforms. */
export function updateShellFresnel(
  obj: THREE.Object3D,
  _camera: THREE.Camera | undefined,
  fresnelEnabled: boolean,
): void {
  const mesh = obj as THREE.Mesh;
  const material = mesh.material;
  if (!(material instanceof THREE.MeshBasicMaterial)) return;
  const uniforms = material.userData.shellFresnelUniforms as
    { uFresnelEnabled: { value: number } } | undefined;
  if (!uniforms) return;
  uniforms.uFresnelEnabled.value = fresnelEnabled ? 1 : 0;
}

/** THREE.Plane through the transmitter along `bearingDeg` (globe-centre coplanar). */
export function buildCutawayClippingPlane(
  txLat: number,
  txLon: number,
  bearingDeg: number,
): THREE.Plane {
  const n = cutawayPlaneNormal(txLat, txLon, bearingDeg);
  const normal = new THREE.Vector3(n.x, n.y, n.z);
  const coplanar = latLonToGlobeDirection(txLat, txLon).multiplyScalar(GLOBE_RADIUS_UNITS);
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, coplanar);
}

/**
 * Sets `clippingPlanes` on existing shell `MeshBasicMaterial`s only
 * (Fresnel-uniforms discriminant). Empty array clears a previous cutaway.
 * Does not recreate materials.
 */
export function applyShellClippingPlanes(obj: THREE.Object3D, planes: THREE.Plane[]): void {
  const mesh = obj as THREE.Mesh;
  const material = mesh.material;
  if (!(material instanceof THREE.MeshBasicMaterial)) return;
  if (!material.userData.shellFresnelUniforms) return;
  material.clippingPlanes = planes;
}

/** Bright greyline so it reads against both the marble and the night shade. */
export const TERMINATOR_PATH_COLOR = '#fff6c8';
/** Lift above the night-shade sphere so the ring is not buried. */
export const TERMINATOR_PATH_ALTITUDE = 0.014;
export const NIGHT_SHADE_OPACITY = 0.48;
export const NIGHT_SHADE_RADIUS_UNITS = GLOBE_RADIUS_UNITS * 1.006;

export type TerminatorPath = {
  kind: 'terminator';
  points: [number, number, number][];
  color: string;
};

function splitRingAtAntimeridian(points: GeoPoint[]): GeoPoint[][] {
  if (points.length === 0) return [];
  const segments: GeoPoint[][] = [[points[0]!]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    if (Math.abs(curr.lonDeg - prev.lonDeg) > 180) {
      segments.push([curr]);
    } else {
      segments[segments.length - 1]!.push(curr);
    }
  }
  return segments.filter((segment) => segment.length >= 2);
}

export function buildTerminatorPaths(ring: GeoPoint[]): TerminatorPath[] {
  return splitRingAtAntimeridian(ring).map((segment) => ({
    kind: 'terminator' as const,
    points: segment.map(
      (p) => [p.latDeg, p.lonDeg, TERMINATOR_PATH_ALTITUDE] as [number, number, number],
    ),
    color: TERMINATOR_PATH_COLOR,
  }));
}

export type NightShadeLayer = {
  kind: 'night-shade';
  sunLatDeg: number;
  sunLonDeg: number;
};

export function isNightShadeLayer(d: object): d is NightShadeLayer {
  return (d as NightShadeLayer).kind === 'night-shade';
}

/**
 * Slightly oversized dark sphere; fragment alpha is 0 on the sunlit
 * hemisphere so only the night side tints the globe.
 */
export function buildNightShadeMesh(d: object): THREE.Object3D {
  const { sunLatDeg, sunLonDeg } = d as NightShadeLayer;
  const geometry = new THREE.SphereGeometry(NIGHT_SHADE_RADIUS_UNITS, 64, 64);
  const material = new THREE.MeshBasicMaterial({
    color: '#070714',
    transparent: true,
    opacity: NIGHT_SHADE_OPACITY,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const sunDir = latLonToGlobeDirection(sunLatDeg, sunLonDeg);
  const uniforms = {
    uSunDir: { value: sunDir },
    uNightOpacity: { value: NIGHT_SHADE_OPACITY },
  };
  material.userData.nightShadeUniforms = uniforms;
  material.customProgramCacheKey = () => 'reach-night-shade';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec3 vGlobeNormal;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vGlobeNormal = normalize(transformed);`,
    );
    shader.fragmentShader = `uniform vec3 uSunDir;
uniform float uNightOpacity;
varying vec3 vGlobeNormal;
${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
         float ndotSun = dot(normalize(vGlobeNormal), normalize(uSunDir));
         float night = 1.0 - smoothstep(-0.12, 0.08, ndotSun);
         diffuseColor.a = uNightOpacity * night;`,
    );
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -1;
  return mesh;
}

export type SunMarkerLayer = {
  kind: 'sun';
  sunLatDeg: number;
  sunLonDeg: number;
};

export function isSunMarkerLayer(d: object): d is SunMarkerLayer {
  return (d as SunMarkerLayer).kind === 'sun';
}

/** True-scale F2 outer radius x 3 -- directional cue, not to scale. F2 day virtual height (300km) matches `layers.ts`. */
export const SUN_MARKER_DISTANCE_UNITS = 3 * shellRadiusUnits(300);
export const SUN_MARKER_RADIUS_UNITS = GLOBE_RADIUS_UNITS * 0.045;
export const SUN_MARKER_COLOR = '#ffe566';

/**
 * Small unlit yellow sphere along the subsolar direction, well outside the
 * F2 shell. No exaggeration, explode, or Fresnel.
 */
export function buildSunMarkerMesh(d: object): THREE.Object3D {
  const { sunLatDeg, sunLonDeg } = d as SunMarkerLayer;
  const geometry = new THREE.SphereGeometry(SUN_MARKER_RADIUS_UNITS, 24, 24);
  const material = new THREE.MeshBasicMaterial({
    color: SUN_MARKER_COLOR,
    depthWrite: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const dir = latLonToGlobeDirection(sunLatDeg, sunLonDeg);
  mesh.position.copy(dir.multiplyScalar(SUN_MARKER_DISTANCE_UNITS));
  mesh.renderOrder = 10;
  return mesh;
}

// ---------------------------------------------------------------------------
// Slice 3 (F6.3): coverage grid as a ground-shading texture.
// ---------------------------------------------------------------------------

/** Just above the marble, comfortably below the night shade and every shell -- see this file's render-order note in HfPropagationGlobe.tsx. */
export const GROUND_SHADE_RADIUS_UNITS = GLOBE_RADIUS_UNITS * 1.001;

export type CoverageGroundLayer = {
  kind: 'coverage-ground';
  result: CoverageGridResult;
  txLat: number;
  txLon: number;
};

export function isCoverageGroundLayer(d: object): d is CoverageGroundLayer {
  return (d as CoverageGroundLayer).kind === 'coverage-ground';
}

export interface CoverageTextureData {
  /** `rangeBinCount` -- the texture's column axis. */
  width: number;
  /** `azimuthCount` -- the texture's row axis. */
  height: number;
  /** RGBA bytes, row-major, `width * height * 4` long -- `THREE.DataTexture`-ready (row 0 = azimuth 0, matching `DataTexture`'s default `flipY: false`). */
  data: Uint8Array;
}

function hexToRgbBytes(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Bakes `cellFillStyle`'s exact hue/opacity scheme (Reach's 2D map,
 * `cellFillStyle.ts`) into an RGBA byte array, one texel per grid cell --
 * pure and unit-testable independent of `THREE.DataTexture`/WebGL. A
 * no-coverage cell (`cellFillStyle` returns `null`) gets `[0,0,0,0]`
 * (already the `Uint8Array` zero-fill default), i.e. fully transparent --
 * the skip zone, same as the 2D map's canvas layer leaving it unpainted.
 */
export function buildCoverageTextureData(result: CoverageGridResult): CoverageTextureData {
  const { azimuthCount, rangeBinCount, hopCount, reliability } = result;
  const data = new Uint8Array(rangeBinCount * azimuthCount * 4);
  for (let az = 0; az < azimuthCount; az++) {
    for (let bin = 0; bin < rangeBinCount; bin++) {
      const idx = az * rangeBinCount + bin;
      const style = cellFillStyle(hopCount[idx]!, reliability[idx]!);
      if (!style) continue;
      const texIdx = idx * 4;
      const [r, g, b] = hexToRgbBytes(style.color);
      data[texIdx] = r;
      data[texIdx + 1] = g;
      data[texIdx + 2] = b;
      data[texIdx + 3] = Math.round(255 * Math.max(0, Math.min(1, style.opacity)));
    }
  }
  return { width: rangeBinCount, height: azimuthCount, data };
}

/**
 * GLSL helpers shared by the ground-shading fragment shader below --
 * `reachNormalToLatLon` is the exact inverse of `latLonToGlobeCartesian`
 * (same spherical convention every mesh in this file uses);
 * `reachGreatCircleBearingDeg`/`reachGreatCircleRangeKm` are the same
 * great-circle formulas as `bearingDistance.ts`'s
 * `initialBearingDeg`/`haversineDistanceKm` (the "exact inverse of phase
 * 8 Slice 2's cell -> coordinate projection" this phase's plan file
 * calls for), translated to GLSL so they can run once per fragment
 * instead of needing a rebuilt geometry every time the station moves.
 */
const GROUND_SHADER_GLSL_HELPERS = `
const float REACH_PI = 3.14159265358979;
const float REACH_DEG2RAD = REACH_PI / 180.0;
const float REACH_RAD2DEG = 180.0 / REACH_PI;
const float REACH_EARTH_RADIUS_KM = 6371.0;

vec2 reachNormalToLatLon(vec3 n) {
  float phi = acos(clamp(n.y, -1.0, 1.0));
  float theta = atan(n.z, n.x);
  float lat = 90.0 - phi * REACH_RAD2DEG;
  float lon = 90.0 - theta * REACH_RAD2DEG;
  lon = mod(lon + 180.0, 360.0) - 180.0;
  return vec2(lat, lon);
}

float reachGreatCircleBearingDeg(vec2 fromLatLon, vec2 toLatLon) {
  float lat1 = fromLatLon.x * REACH_DEG2RAD;
  float lat2 = toLatLon.x * REACH_DEG2RAD;
  float dLon = (toLatLon.y - fromLatLon.y) * REACH_DEG2RAD;
  float y = sin(dLon) * cos(lat2);
  float x = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon);
  float bearing = atan(y, x) * REACH_RAD2DEG;
  return mod(bearing + 360.0, 360.0);
}

float reachGreatCircleRangeKm(vec2 fromLatLon, vec2 toLatLon) {
  float lat1 = fromLatLon.x * REACH_DEG2RAD;
  float lat2 = toLatLon.x * REACH_DEG2RAD;
  float dLat = (toLatLon.x - fromLatLon.x) * REACH_DEG2RAD;
  float dLon = (toLatLon.y - fromLatLon.y) * REACH_DEG2RAD;
  float a = sin(dLat * 0.5) * sin(dLat * 0.5) + cos(lat1) * cos(lat2) * sin(dLon * 0.5) * sin(dLon * 0.5);
  float c = 2.0 * atan(sqrt(a), sqrt(1.0 - a));
  return REACH_EARTH_RADIUS_KM * c;
}
`;

interface CoverageGroundUniforms {
  uCoverageTexture: { value: THREE.DataTexture };
  uTxLat: { value: number };
  uTxLon: { value: number };
  uMaxRangeKm: { value: number };
}

function coverageGroundUniformsOf(mesh: THREE.Mesh): CoverageGroundUniforms | undefined {
  const material = mesh.material;
  if (!(material instanceof THREE.MeshBasicMaterial)) return undefined;
  return material.userData.coverageGroundUniforms as CoverageGroundUniforms | undefined;
}

/** Writes a fresh `CoverageGridResult` into an existing texture in place -- never reallocates unless the grid's own shape changed (it shouldn't, mid-session; `COVERAGE_*` constants are fixed). */
function writeCoverageTexture(mesh: THREE.Mesh, layer: CoverageGroundLayer): void {
  const uniforms = coverageGroundUniformsOf(mesh);
  if (!uniforms) return;
  const texData = buildCoverageTextureData(layer.result);
  const texture = uniforms.uCoverageTexture.value;
  const image = texture.image as { data: Uint8Array; width: number; height: number };
  if (image.width === texData.width && image.height === texData.height) {
    image.data.set(texData.data);
  } else {
    texture.image = { data: texData.data, width: texData.width, height: texData.height };
  }
  texture.needsUpdate = true;
  uniforms.uTxLat.value = layer.txLat;
  uniforms.uTxLon.value = layer.txLon;
  uniforms.uMaxRangeKm.value = layer.result.rangeBinCount * layer.result.rangeBinKm;
}

/**
 * Builds the ONE ground-shading mesh (create path, called once by
 * `customThreeObject`) -- a thin sphere at ground radius whose fragment
 * shader converts each fragment's position to (bearing, range) from the
 * transmitter and samples a `THREE.DataTexture` built from the current
 * `CoverageGridResult`. See `updateCoverageGroundMesh` for the "update in
 * place" path (`customThreeObjectUpdate`) that keeps this same mesh/
 * texture across every new coarse/fine grid result -- react-globe.gl (via
 * `three-globe`'s d3-style data join) tracks `customLayerData` entries by
 * array position, so as long as this entry stays at a stable index,
 * `customThreeObjectUpdate` -- not this function -- runs on every
 * subsequent grid update.
 */
export function buildCoverageGroundMesh(d: object): THREE.Object3D {
  const layer = d as CoverageGroundLayer;
  const texData = buildCoverageTextureData(layer.result);
  const texture = new THREE.DataTexture(
    texData.data,
    texData.width,
    texData.height,
    THREE.RGBAFormat,
  );
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping; // range axis -- does not wrap
  texture.wrapT = THREE.RepeatWrapping; // azimuth axis -- wraps at 0/360deg
  texture.needsUpdate = true;

  const geometry = new THREE.SphereGeometry(GROUND_SHADE_RADIUS_UNITS, 96, 96);
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const uniforms: CoverageGroundUniforms = {
    uCoverageTexture: { value: texture },
    uTxLat: { value: layer.txLat },
    uTxLon: { value: layer.txLon },
    uMaxRangeKm: { value: layer.result.rangeBinCount * layer.result.rangeBinKm },
  };
  material.userData.coverageGroundUniforms = uniforms;
  material.customProgramCacheKey = () => 'reach-coverage-ground';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `varying vec3 vGroundObjectNormal;
${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vGroundObjectNormal = normalize(position);`,
    );
    shader.fragmentShader = `uniform sampler2D uCoverageTexture;
uniform float uTxLat;
uniform float uTxLon;
uniform float uMaxRangeKm;
varying vec3 vGroundObjectNormal;
${GROUND_SHADER_GLSL_HELPERS}
${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
         vec2 reachFragLatLon = reachNormalToLatLon(normalize(vGroundObjectNormal));
         float reachBearingDeg = reachGreatCircleBearingDeg(vec2(uTxLat, uTxLon), reachFragLatLon);
         float reachRangeKm = reachGreatCircleRangeKm(vec2(uTxLat, uTxLon), reachFragLatLon);
         float reachRangeFrac = reachRangeKm / max(uMaxRangeKm, 1.0);
         if (reachRangeFrac > 1.0) discard;
         float reachBearingFrac = reachBearingDeg / 360.0;
         vec4 reachTexel = texture2D(uCoverageTexture, vec2(reachRangeFrac, reachBearingFrac));
         if (reachTexel.a <= 0.0) discard;
         diffuseColor = vec4(reachTexel.rgb, reachTexel.a);`,
    );
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = -3;
  mesh.userData.isCoverageGround = true;
  return mesh;
}

/**
 * "Update in place" path (`customThreeObjectUpdate`) -- rewrites the
 * existing texture's bytes and the transmitter/max-range uniforms,
 * touches neither geometry nor material. A no-op (not a crash) if handed
 * an `obj` this module didn't build (`userData.isCoverageGround` unset)
 * or a `d` that isn't a `CoverageGroundLayer`.
 */
export function updateCoverageGroundMesh(obj: THREE.Object3D, d: object): void {
  if (!isCoverageGroundLayer(d)) return;
  const mesh = obj as THREE.Mesh;
  if (!mesh.userData.isCoverageGround) return;
  writeCoverageTexture(mesh, d);
}
