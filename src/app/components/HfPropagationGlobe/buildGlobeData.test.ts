import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import type { LayerState } from '@core/domain/propagation/layers';
import { cellFillStyle } from '../reach/cellFillStyle.ts';
import {
  buildCoverageGroundMesh,
  buildCoverageTextureData,
  buildNightShadeMesh,
  buildShellMesh,
  buildSunMarkerMesh,
  buildTerminatorPaths,
  canonicalLayerIndex,
  dayNightFactor,
  dLayerPresence,
  displayShellRadiusUnits,
  explodeOffsetUnits,
  exaggeratedAltitudeKm,
  GLOBE_RADIUS_UNITS,
  shellBaselineOpacity,
  shellNightPresence,
  shellPresence,
  shellRadiusUnits,
  updateCoverageGroundMesh,
  type ShellDisplayOptions,
} from './buildGlobeData.ts';

const TRUE_SCALE: ShellDisplayOptions = {
  exaggerationFactor: 1,
  explodeEnabled: false,
  fresnelEnabled: false,
};

describe('canonicalLayerIndex', () => {
  it('orders D, E, F1, F2 inner to outer', () => {
    expect(canonicalLayerIndex('D')).toBe(0);
    expect(canonicalLayerIndex('E')).toBe(1);
    expect(canonicalLayerIndex('F1')).toBe(2);
    expect(canonicalLayerIndex('F2')).toBe(3);
  });
});

describe('shellBaselineOpacity', () => {
  it('steps down 0.05 per layer from D=0.28', () => {
    expect(shellBaselineOpacity(0)).toBeCloseTo(0.28, 5);
    expect(shellBaselineOpacity(1)).toBeCloseTo(0.23, 5);
    expect(shellBaselineOpacity(2)).toBeCloseTo(0.18, 5);
    expect(shellBaselineOpacity(3)).toBeCloseTo(0.13, 5);
  });

  it('never goes negative', () => {
    expect(shellBaselineOpacity(100)).toBe(0);
  });
});

describe('exaggeratedAltitudeKm', () => {
  it('is a no-op at factor <= 1', () => {
    expect(exaggeratedAltitudeKm(300, 1)).toBe(300);
    expect(exaggeratedAltitudeKm(300, 0.5)).toBe(300);
    expect(exaggeratedAltitudeKm(300, Number.NaN)).toBe(300);
  });

  it('multiplies altitude by factor above 1', () => {
    expect(exaggeratedAltitudeKm(300, 2.5)).toBeCloseTo(750, 5);
  });
});

describe('explodeOffsetUnits', () => {
  it('is 0 when disabled regardless of index', () => {
    expect(explodeOffsetUnits(3, false)).toBe(0);
  });

  it('scales with canonical layer index when enabled', () => {
    expect(explodeOffsetUnits(0, true)).toBe(0);
    expect(explodeOffsetUnits(3, true)).toBeCloseTo(0.45, 5);
  });
});

describe('displayShellRadiusUnits / shellRadiusUnits', () => {
  it('true-scale radius grows with virtual height', () => {
    const dRadius = shellRadiusUnits(90);
    const f2Radius = shellRadiusUnits(300);
    expect(f2Radius).toBeGreaterThan(dRadius);
    expect(dRadius).toBeGreaterThan(GLOBE_RADIUS_UNITS);
  });

  it('exaggeration increases radius beyond true scale', () => {
    const trueRadius = displayShellRadiusUnits(300, 3, TRUE_SCALE);
    const exaggerated = displayShellRadiusUnits(300, 3, { ...TRUE_SCALE, exaggerationFactor: 5 });
    expect(exaggerated).toBeGreaterThan(trueRadius);
  });

  it('explode increases outer-layer radius more than inner-layer radius', () => {
    const display = { ...TRUE_SCALE, explodeEnabled: true };
    const base = displayShellRadiusUnits(90, 0, TRUE_SCALE);
    const explodedD = displayShellRadiusUnits(90, 0, display);
    const explodedF2 = displayShellRadiusUnits(90, 3, display);
    expect(explodedD).toBeCloseTo(base, 5); // index 0 -> no offset
    expect(explodedF2).toBeGreaterThan(explodedD);
  });
});

describe('day/night presence math', () => {
  it('dayNightFactor is 0 well into night and 1 well into day', () => {
    expect(dayNightFactor(-1)).toBe(0);
    expect(dayNightFactor(1)).toBe(1);
  });

  it('shellNightPresence: D and F1 vanish at night, E dims, F2 stays', () => {
    expect(shellNightPresence('D')).toBe(0);
    expect(shellNightPresence('F1')).toBe(0);
    expect(shellNightPresence('E')).toBeCloseTo(0.45, 5);
    expect(shellNightPresence('F2')).toBe(1);
  });

  it('dLayerPresence thins out approaching the terminator from the day side', () => {
    expect(dLayerPresence(1)).toBeCloseTo(1, 5);
    expect(dLayerPresence(-1)).toBeCloseTo(0, 5);
  });

  it('shellPresence: D at night is ~0, F2 stays ~1 day or night', () => {
    expect(shellPresence('D', -1)).toBeCloseTo(0, 5);
    expect(shellPresence('F2', -1)).toBeCloseTo(1, 5);
    expect(shellPresence('F2', 1)).toBeCloseTo(1, 5);
  });
});

describe('buildTerminatorPaths', () => {
  it('carries the ring points through at the terminator altitude', () => {
    const ring = [
      { latDeg: 0, lonDeg: 0 },
      { latDeg: 10, lonDeg: 10 },
      { latDeg: 0, lonDeg: 0 },
    ];
    const paths = buildTerminatorPaths(ring);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.kind).toBe('terminator');
    expect(paths[0]!.points).toHaveLength(3);
    expect(paths[0]!.points[0]).toEqual([0, 0, 0.014]);
  });

  it('splits into separate segments at the antimeridian', () => {
    const ring = [
      { latDeg: 0, lonDeg: 160 },
      { latDeg: 0, lonDeg: 170 },
      { latDeg: 0, lonDeg: -170 }, // jumps > 180deg -> new segment
      { latDeg: 0, lonDeg: -160 },
    ];
    const paths = buildTerminatorPaths(ring);
    expect(paths).toHaveLength(2);
    expect(paths[0]!.points).toHaveLength(2);
    expect(paths[1]!.points).toHaveLength(2);
  });

  it('drops single-point segments entirely', () => {
    const ring = [
      { latDeg: 0, lonDeg: 0 },
      { latDeg: 0, lonDeg: 179 },
    ];
    const paths = buildTerminatorPaths(ring);
    // First segment has only [0,0] before the antimeridian jump -> filtered (length < 2).
    expect(paths.every((p) => p.points.length >= 2)).toBe(true);
  });
});

function fixtureLayer(id: LayerState['id'], virtualHeightKm: number): LayerState {
  return { id, virtualHeightKm, criticalFrequencyMhz: id === 'D' ? null : 5 };
}

describe('buildShellMesh', () => {
  it('returns a THREE.Mesh coloured per layerColor and sized per virtualHeightKm', () => {
    const mesh = buildShellMesh(fixtureLayer('F2', 300), 3, TRUE_SCALE) as THREE.Mesh;
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const geometry = mesh.geometry as THREE.SphereGeometry;
    expect(geometry.parameters.radius).toBeCloseTo(shellRadiusUnits(300), 5);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.color.getHexString()).toBe('5ec8ff');
  });

  it('paints outer shells first (lower renderOrder) so inner shells are not buried', () => {
    const dMesh = buildShellMesh(fixtureLayer('D', 90), 0, TRUE_SCALE);
    const f2Mesh = buildShellMesh(fixtureLayer('F2', 300), 3, TRUE_SCALE);
    expect(dMesh.renderOrder).toBeGreaterThan(f2Mesh.renderOrder);
  });
});

describe('buildNightShadeMesh / buildSunMarkerMesh', () => {
  it('night shade is a large dark translucent sphere', () => {
    const mesh = buildNightShadeMesh({
      kind: 'night-shade',
      sunLatDeg: 0,
      sunLonDeg: 0,
    }) as THREE.Mesh;
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
  });

  it('sun marker sits far outside the globe along the subsolar direction', () => {
    const mesh = buildSunMarkerMesh({ kind: 'sun', sunLatDeg: 0, sunLonDeg: 0 });
    expect(mesh.position.length()).toBeGreaterThan(GLOBE_RADIUS_UNITS * 2);
  });
});

// --- Slice 3: coverage ground-shading texture ---------------------------

function fixtureCoverageGridResult(): CoverageGridResult {
  const azimuthCount = 4;
  const rangeBinCount = 3;
  const hopCount = new Uint8Array(azimuthCount * rangeBinCount);
  const reliability = new Float32Array(azimuthCount * rangeBinCount);
  const snrDb = new Float32Array(azimuthCount * rangeBinCount);
  // az0: groundwave, high reliability; az1: hop 2, mid reliability; az2: skip zone (255); az3: hop4
  hopCount.set([0, 1, 2]); // az0 bins 0..2
  reliability.set([0.9, 0.5, 0.1]);
  hopCount.set([1, 2, 3], 3); // az1
  reliability.set([0.6, 0.4, 0.2], 3);
  hopCount.set([255, 255, 255], 6); // az2 -- skip zone
  reliability.set([0, 0, 0], 6);
  hopCount.set([4, 4, 4], 9); // az3
  reliability.set([1, 1, 1], 9);
  return { azimuthCount, rangeBinCount, rangeBinKm: 50, reliability, snrDb, hopCount };
}

describe('buildCoverageTextureData', () => {
  it('matches cellFillStyle exactly for every cell (hue + opacity parity with the 2D map)', () => {
    const result = fixtureCoverageGridResult();
    const tex = buildCoverageTextureData(result);
    expect(tex.width).toBe(result.rangeBinCount);
    expect(tex.height).toBe(result.azimuthCount);
    for (let az = 0; az < result.azimuthCount; az++) {
      for (let bin = 0; bin < result.rangeBinCount; bin++) {
        const idx = az * result.rangeBinCount + bin;
        const style = cellFillStyle(result.hopCount[idx]!, result.reliability[idx]!);
        const texIdx = idx * 4;
        if (!style) {
          expect(tex.data[texIdx + 3]).toBe(0); // no-coverage cells are fully transparent
          continue;
        }
        const expectedR = parseInt(style.color.slice(1, 3), 16);
        const expectedG = parseInt(style.color.slice(3, 5), 16);
        const expectedB = parseInt(style.color.slice(5, 7), 16);
        expect(tex.data[texIdx]).toBe(expectedR);
        expect(tex.data[texIdx + 1]).toBe(expectedG);
        expect(tex.data[texIdx + 2]).toBe(expectedB);
        expect(tex.data[texIdx + 3]).toBe(Math.round(255 * style.opacity));
      }
    }
  });

  it('leaves the skip zone fully transparent (zero fill, not a near-zero-alpha colour)', () => {
    const result = fixtureCoverageGridResult();
    const tex = buildCoverageTextureData(result);
    const idx = 2 * result.rangeBinCount + 0; // az2 bin0 -> hopCount 255
    const texIdx = idx * 4;
    expect([...tex.data.slice(texIdx, texIdx + 4)]).toEqual([0, 0, 0, 0]);
  });
});

describe('buildCoverageGroundMesh / updateCoverageGroundMesh', () => {
  it('builds one mesh with a DataTexture uniform sized to the grid', () => {
    const result = fixtureCoverageGridResult();
    const mesh = buildCoverageGroundMesh({
      kind: 'coverage-ground',
      result,
      txLat: 51.5,
      txLon: -0.13,
    }) as THREE.Mesh;
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.userData.isCoverageGround).toBe(true);
    const material = mesh.material as THREE.MeshBasicMaterial;
    const uniforms = material.userData.coverageGroundUniforms as {
      uCoverageTexture: { value: THREE.DataTexture };
      uTxLat: { value: number };
      uTxLon: { value: number };
    };
    expect(uniforms.uCoverageTexture.value.image.width).toBe(result.rangeBinCount);
    expect(uniforms.uCoverageTexture.value.image.height).toBe(result.azimuthCount);
    expect(uniforms.uTxLat.value).toBe(51.5);
  });

  it('update-in-place rewrites the SAME texture/material without replacing the mesh', () => {
    const result = fixtureCoverageGridResult();
    const mesh = buildCoverageGroundMesh({
      kind: 'coverage-ground',
      result,
      txLat: 0,
      txLon: 0,
    }) as THREE.Mesh;
    const material = mesh.material as THREE.MeshBasicMaterial;
    const uniforms = material.userData.coverageGroundUniforms as {
      uCoverageTexture: { value: THREE.DataTexture };
      uTxLat: { value: number };
    };
    const textureBefore = uniforms.uCoverageTexture.value;

    const nextResult = fixtureCoverageGridResult();
    nextResult.reliability[0] = 0.42;
    updateCoverageGroundMesh(mesh, {
      kind: 'coverage-ground',
      result: nextResult,
      txLat: 10,
      txLon: 20,
    });

    expect(mesh.material).toBe(material); // same material instance
    expect(uniforms.uCoverageTexture.value).toBe(textureBefore); // same texture instance, contents rewritten
    expect(uniforms.uTxLat.value).toBe(10);
    const style = cellFillStyle(nextResult.hopCount[0]!, 0.42)!;
    const expectedAlpha = Math.round(255 * style.opacity);
    const image = textureBefore.image as { data: Uint8Array };
    expect(image.data[3]).toBe(expectedAlpha);
  });

  it('is a no-op when handed an object it did not build', () => {
    const geometry = new THREE.SphereGeometry(1);
    const material = new THREE.MeshBasicMaterial();
    const foreignMesh = new THREE.Mesh(geometry, material);
    expect(() =>
      updateCoverageGroundMesh(foreignMesh, {
        kind: 'coverage-ground',
        result: fixtureCoverageGridResult(),
        txLat: 0,
        txLon: 0,
      }),
    ).not.toThrow();
  });
});
