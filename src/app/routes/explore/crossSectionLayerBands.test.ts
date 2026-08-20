import { describe, expect, it } from 'vitest';
import { layerStates } from '@core/domain/propagation/layers';
import { crossSectionLayerBands } from './crossSectionLayerBands.ts';

const NOON_ZENITH_DEG = 0;
const MIDNIGHT_ZENITH_DEG = 180;

describe('crossSectionLayerBands', () => {
  it('includes D and F1 in daylight (both active per layers.ts)', () => {
    const layers = layerStates(120, 0, NOON_ZENITH_DEG, 0);
    const bands = crossSectionLayerBands(layers, NOON_ZENITH_DEG);
    const ids = bands.map((b) => b.layer).sort();
    expect(ids).toEqual(['D', 'E', 'F1', 'F2']);
  });

  it('excludes D and F1 at night, keeps E and F2', () => {
    const layers = layerStates(120, 0, MIDNIGHT_ZENITH_DEG, 0);
    const bands = crossSectionLayerBands(layers, MIDNIGHT_ZENITH_DEG);
    const ids = bands.map((b) => b.layer).sort();
    expect(ids).toEqual(['E', 'F2']);
  });

  it('F2 is always present, day or night', () => {
    for (const zenithDeg of [NOON_ZENITH_DEG, 60, 89, 90, 120, MIDNIGHT_ZENITH_DEG]) {
      const layers = layerStates(120, 0, zenithDeg, 0);
      const bands = crossSectionLayerBands(layers, zenithDeg);
      expect(bands.some((b) => b.layer === 'F2')).toBe(true);
    }
  });

  it("band heights match layerStates' own virtualHeightKm exactly", () => {
    const layers = layerStates(120, 0, NOON_ZENITH_DEG, 0);
    const bands = crossSectionLayerBands(layers, NOON_ZENITH_DEG);
    for (const band of bands) {
      const source = layers.find((l) => l.id === band.layer);
      expect(band.heightKm).toBe(source?.virtualHeightKm);
    }
  });
});
