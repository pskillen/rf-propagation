import { describe, expect, it } from 'vitest';
import { layerStates } from './layers';

function byId(states: ReturnType<typeof layerStates>, id: 'D' | 'E' | 'F1' | 'F2') {
  const state = states.find((s) => s.id === id);
  if (!state) throw new Error(`layer ${id} missing from layerStates() result`);
  return state;
}

describe('layerStates', () => {
  it('returns all four layers', () => {
    const states = layerStates(120, 0, 0, 0);
    expect(states.map((s) => s.id).sort()).toEqual(['D', 'E', 'F1', 'F2']);
  });

  it('D always has criticalFrequencyMhz: null, day or night', () => {
    expect(byId(layerStates(120, 0, 0, 0), 'D').criticalFrequencyMhz).toBeNull();
    expect(byId(layerStates(120, 0, 130, 0), 'D').criticalFrequencyMhz).toBeNull();
  });

  describe('worked check: chi=0deg, SFI=120', () => {
    const states = layerStates(120, 0, 0, 0);

    it('foE ~= 3.9 MHz', () => {
      expect(byId(states, 'E').criticalFrequencyMhz).toBeCloseTo(3.9, 1);
    });

    it('foF2 ~= 8.0 MHz', () => {
      expect(byId(states, 'F2').criticalFrequencyMhz).toBeCloseTo(8.0, 1);
    });

    it('foE < foF1 < foF2', () => {
      const foE = byId(states, 'E').criticalFrequencyMhz!;
      const foF1 = byId(states, 'F1').criticalFrequencyMhz!;
      const foF2 = byId(states, 'F2').criticalFrequencyMhz!;
      expect(foE).toBeLessThan(foF1);
      expect(foF1).toBeLessThan(foF2);
    });
  });

  describe('day/night behaviour', () => {
    it('F1 is active by day (chi < 75deg)', () => {
      expect(byId(layerStates(120, 0, 30, 0), 'F1').criticalFrequencyMhz).not.toBeNull();
    });

    it('F1 is inactive (null) once chi >= 75deg', () => {
      expect(byId(layerStates(120, 0, 75, 0), 'F1').criticalFrequencyMhz).toBeNull();
      expect(byId(layerStates(120, 0, 130, 0), 'F1').criticalFrequencyMhz).toBeNull();
    });

    it('E persists at night at its floor (0.5 MHz) rather than vanishing', () => {
      const nightE = byId(layerStates(120, 0, 130, 0), 'E').criticalFrequencyMhz;
      expect(nightE).not.toBeNull();
      expect(nightE).toBeCloseTo(0.5, 5);
    });

    it('F2 persists at night and thins relative to day', () => {
      const dayF2 = byId(layerStates(120, 0, 0, 0), 'F2').criticalFrequencyMhz!;
      const nightF2 = byId(layerStates(120, 0, 130, 0), 'F2').criticalFrequencyMhz!;
      expect(nightF2).not.toBeNull();
      expect(nightF2).toBeLessThan(dayF2);
      // night value should sit at the 0.45x noon floor
      const noon = 6.0 + 0.04 * (120 - 70);
      expect(nightF2).toBeCloseTo(0.45 * noon, 5);
    });

    it('F2 virtual height is 300km by day and 350km by night', () => {
      expect(byId(layerStates(120, 0, 0, 0), 'F2').virtualHeightKm).toBe(300);
      expect(byId(layerStates(120, 0, 130, 0), 'F2').virtualHeightKm).toBe(350);
    });
  });

  describe('Kp degrades F2 toward the auroral zone', () => {
    it('visibly lowers foF2 at high geomagnetic latitude', () => {
      const quiet = byId(layerStates(120, 0, 0, 75), 'F2').criticalFrequencyMhz!;
      const disturbed = byId(layerStates(120, 9, 0, 75), 'F2').criticalFrequencyMhz!;
      expect(disturbed).toBeLessThan(quiet);
    });

    it('has no effect at geomagnetic latitude near the equator', () => {
      const quiet = byId(layerStates(120, 0, 0, 0), 'F2').criticalFrequencyMhz!;
      const disturbed = byId(layerStates(120, 9, 0, 0), 'F2').criticalFrequencyMhz!;
      expect(disturbed).toBeCloseTo(quiet, 9);
    });

    it('has no effect at geomagnetic latitude exactly 45deg (clamp boundary)', () => {
      const quiet = byId(layerStates(120, 0, 0, 45), 'F2').criticalFrequencyMhz!;
      const disturbed = byId(layerStates(120, 9, 0, 45), 'F2').criticalFrequencyMhz!;
      expect(disturbed).toBeCloseTo(quiet, 9);
    });
  });

  describe('virtual heights', () => {
    it('D is 90km, E is 110km, F1 is 200km', () => {
      const states = layerStates(120, 0, 0, 0);
      expect(byId(states, 'D').virtualHeightKm).toBe(90);
      expect(byId(states, 'E').virtualHeightKm).toBe(110);
      expect(byId(states, 'F1').virtualHeightKm).toBe(200);
    });
  });
});
