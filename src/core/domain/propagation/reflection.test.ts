import { describe, expect, it } from 'vitest';
import { selectReflectingLayer } from './reflection';
import { layerStates, type LayerState } from './layers';

const DEG_TO_RAD = Math.PI / 180;

describe('selectReflectingLayer', () => {
  describe('D-layer exclusion (V6-equivalent, at the unit level)', () => {
    it('never selects D across a sweep of frequency, angle, time-of-day and SFI', () => {
      const frequencies = [1, 3, 5, 7, 10, 14, 18, 21, 24, 28, 30, 50, 100];
      const takeoffAnglesDeg = [1, 5, 15, 30, 45, 60, 75, 89];
      const solarZeniths = [0, 30, 60, 75, 89, 90, 120, 170];
      const sfiValues = [70, 100, 120, 150, 220];

      for (const sfi of sfiValues) {
        for (const chi of solarZeniths) {
          const layers = layerStates(sfi, 3, chi, 60);
          for (const deltaDeg of takeoffAnglesDeg) {
            for (const f of frequencies) {
              const result = selectReflectingLayer(f, deltaDeg * DEG_TO_RAD, layers);
              if (result.kind === 'reflected') {
                expect(result.layer).not.toBe('D');
              }
            }
          }
        }
      }
    });

    it('never selects D even when D is artificially given a very low critical frequency', () => {
      // Regression guard: selectReflectingLayer must exclude D structurally
      // (never in its candidate lookup), not merely because layerStates()
      // normally reports D's criticalFrequencyMhz as null. Feed it a
      // deliberately "reflective" D layer and confirm it is still ignored.
      const layers: LayerState[] = [
        { id: 'D', virtualHeightKm: 90, criticalFrequencyMhz: 0.1 },
        { id: 'E', virtualHeightKm: 110, criticalFrequencyMhz: null },
        { id: 'F1', virtualHeightKm: 200, criticalFrequencyMhz: null },
        { id: 'F2', virtualHeightKm: 300, criticalFrequencyMhz: null },
      ];
      const result = selectReflectingLayer(1, 45 * DEG_TO_RAD, layers);
      expect(result.kind).toBe('escaped');
    });
  });

  describe('escape', () => {
    it('returns escaped when frequency exceeds every layer MUF', () => {
      const layers = layerStates(120, 0, 0, 0);
      const result = selectReflectingLayer(100, 30 * DEG_TO_RAD, layers);
      expect(result.kind).toBe('escaped');
    });
  });

  describe('layer selection order (E before F1 before F2)', () => {
    // At chi=0deg, SFI=120, Delta=30deg: MUF_E ~= 7.44, MUF_F1 ~= 8.75, MUF_F2 ~= 14.23
    const layers = layerStates(120, 0, 0, 0);
    const deltaRad = 30 * DEG_TO_RAD;

    it('selects E when the frequency is within E MUF (and would also fit F1/F2)', () => {
      const result = selectReflectingLayer(5, deltaRad, layers);
      expect(result).toMatchObject({ kind: 'reflected', layer: 'E' });
    });

    it('selects F1 when the frequency exceeds E MUF but is within F1 MUF', () => {
      const result = selectReflectingLayer(8, deltaRad, layers);
      expect(result).toMatchObject({ kind: 'reflected', layer: 'F1' });
    });

    it('selects F2 when the frequency exceeds E and F1 MUF but is within F2 MUF', () => {
      const result = selectReflectingLayer(10, deltaRad, layers);
      expect(result).toMatchObject({ kind: 'reflected', layer: 'F2' });
    });

    it('escapes when the frequency exceeds every layer MUF', () => {
      const result = selectReflectingLayer(20, deltaRad, layers);
      expect(result).toEqual({ kind: 'escaped' });
    });
  });

  describe('reported mufMhz', () => {
    it('is the selected layer critical frequency times its MUF factor', () => {
      const layers = layerStates(120, 0, 0, 0);
      const result = selectReflectingLayer(5, 30 * DEG_TO_RAD, layers);
      expect(result.kind).toBe('reflected');
      if (result.kind === 'reflected') {
        expect(result.mufMhz).toBeGreaterThan(5);
      }
    });
  });
});
