/**
 * Slice 3 tests (F8.3, #68) -- the coverage-grid/ray-generation
 * independence invariant, restated for filter/colour-by/solo: applying
 * any combination of `outcomeFilter`/`colourBy`/`soloLayerId` must never
 * call `generateIllustrationRays` or `computeCoverageGrid` again for the
 * same underlying `display`/station/conditions -- `computeIllustrationRayBudget`
 * calling `computeLinkBudget` per visible ray (for `colourBy:
 * 'signalStrength'`) is expected and fine.
 */
import { describe, expect, it, vi } from 'vitest';
import type { AntennaConfig } from '@core/domain/station/types';
import { layerStates } from '@core/domain/propagation/layers';
import { ssnFromSfi } from '@core/domain/propagation/losses';
import type { CoverageGridInput } from '@core/domain/propagation/coverageGrid';
import * as coverageGridModule from '@core/domain/propagation/coverageGrid';
import * as illustrationRaysModule from '@core/domain/propagation/illustrationRays';
import { generateIllustrationRays } from '@core/domain/propagation/illustrationRays';
import { DEFAULT_RAY_CONTROLS, type RayControlsState } from '../../state/rayControls.ts';
import { applyRayVisuals } from './rayVisual.ts';

const EQUINOX_SOLAR_NOON_UTC = Date.UTC(2024, 2, 20, 12, 0, 0);

const STANDARD_ANTENNA: AntennaConfig = {
  id: 'standard-test-antenna',
  name: 'Test vertical',
  family: 'omnidirectional-vertical',
  heightM: 10,
  gainDbi: 6,
};

function context(): CoverageGridInput {
  return {
    txLat: 0,
    txLon: 0,
    atMs: EQUINOX_SOLAR_NOON_UTC,
    frequencyMhz: 14,
    layers: layerStates(120, 0, 0, 0),
    ssn: ssnFromSfi(120),
    txPowerW: 100,
    txAntenna: STANDARD_ANTENNA,
    rxAntennaGainDbi: 6,
    groundType: 'land',
    noiseEnvironment: 'rural',
    bandwidthHz: 2400,
  };
}

describe('applyRayVisuals -- coverage-grid/ray-generation independence (F8.3 acceptance criterion)', () => {
  it('never calls generateIllustrationRays or computeCoverageGrid, for any filter/colourBy/solo combination', () => {
    const generateSpy = vi.spyOn(illustrationRaysModule, 'generateIllustrationRays');
    const coverageSpy = vi.spyOn(coverageGridModule, 'computeCoverageGrid');
    const ctx = context();
    const rays = generateIllustrationRays(
      { radialCount: 8, elevationCount: 3, elevationSpreadDeg: [5, 70], mode: 'rose' },
      ctx,
    );
    generateSpy.mockClear();
    coverageSpy.mockClear();

    const combinations: RayControlsState[] = [
      { ...DEFAULT_RAY_CONTROLS, outcomeFilter: 'all', colourBy: 'mode' },
      { ...DEFAULT_RAY_CONTROLS, outcomeFilter: 'escaped', colourBy: 'layer' },
      { ...DEFAULT_RAY_CONTROLS, outcomeFilter: 'returned', colourBy: 'signalStrength' },
      {
        ...DEFAULT_RAY_CONTROLS,
        outcomeFilter: 'absorbed',
        colourBy: 'signalStrength',
        soloLayerId: 'F2',
      },
      { ...DEFAULT_RAY_CONTROLS, colourBy: 'layer', soloLayerId: 'E' },
    ];

    for (const rayControls of combinations) {
      applyRayVisuals(rays, rayControls, ctx);
    }

    expect(generateSpy).not.toHaveBeenCalled();
    expect(coverageSpy).not.toHaveBeenCalled();

    generateSpy.mockRestore();
    coverageSpy.mockRestore();
  });

  it('outcomeFilter is a pure array filter -- rays kept all have the requested outcome', () => {
    const ctx = context();
    const rays = generateIllustrationRays(
      { radialCount: 8, elevationCount: 3, elevationSpreadDeg: [5, 70], mode: 'rose' },
      ctx,
    );
    const rendered = applyRayVisuals(
      rays,
      { ...DEFAULT_RAY_CONTROLS, outcomeFilter: 'escaped' },
      ctx,
    );
    expect(rendered.every((r) => r.ray.outcome === 'escaped')).toBe(true);
  });

  it('soloLayerId dims (does not remove) rays that never reflected off the soloed layer', () => {
    const ctx = context();
    const rays = generateIllustrationRays(
      { radialCount: 8, elevationCount: 3, elevationSpreadDeg: [5, 70], mode: 'rose' },
      ctx,
    );
    const rendered = applyRayVisuals(rays, { ...DEFAULT_RAY_CONTROLS, soloLayerId: 'F2' }, ctx);
    expect(rendered).toHaveLength(rays.length);
    for (const r of rendered) {
      expect(r.dimmed).toBe(!r.ray.reflectingLayers.includes('F2'));
    }
  });

  it("colourBy: 'layer' falls back to a neutral colour for an escaped ray (empty reflectingLayers)", () => {
    const ctx = context();
    const rays = generateIllustrationRays(
      { radialCount: 1, elevationCount: 1, elevationSpreadDeg: [45, 45], mode: 'rose' },
      { ...ctx, frequencyMhz: 100 }, // far above every layer's MUF -- always escapes
    );
    const rendered = applyRayVisuals(rays, { ...DEFAULT_RAY_CONTROLS, colourBy: 'layer' }, ctx);
    expect(rendered[0]!.ray.outcome).toBe('escaped');
    expect(rendered[0]!.ray.reflectingLayers).toHaveLength(0);
    expect(rendered[0]!.color).toBeTruthy();
  });
});
