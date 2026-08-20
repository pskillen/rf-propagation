import { describe, expect, it } from 'vitest';
import { locatorToCoords } from '@core/domain/maidenhead';
import { resolveTarget } from './resolveTarget.ts';

const BASE_ARGS = {
  manualLat: 0,
  manualLon: 0,
  locatorInput: '',
  geocodedCoords: null,
  geocodedLabel: null,
};

describe('resolveTarget', () => {
  describe('coordinates mode', () => {
    it('resolves valid lat/lon', () => {
      const target = resolveTarget({
        ...BASE_ARGS,
        mode: 'coordinates',
        manualLat: 51.5,
        manualLon: -0.12,
      });
      expect(target).toEqual({ lat: 51.5, lon: -0.12, source: 'coordinates' });
    });

    it('returns null for out-of-range latitude', () => {
      expect(
        resolveTarget({ ...BASE_ARGS, mode: 'coordinates', manualLat: 91, manualLon: 0 }),
      ).toBeNull();
    });

    it('returns null for out-of-range longitude', () => {
      expect(
        resolveTarget({ ...BASE_ARGS, mode: 'coordinates', manualLat: 0, manualLon: 181 }),
      ).toBeNull();
    });

    it('returns null for a non-finite value', () => {
      expect(
        resolveTarget({ ...BASE_ARGS, mode: 'coordinates', manualLat: Number.NaN, manualLon: 0 }),
      ).toBeNull();
    });
  });

  describe('locator mode', () => {
    it('round-trips a known locator to known coordinates via maidenhead.ts', () => {
      const expected = locatorToCoords('IO85vs')!;
      const target = resolveTarget({ ...BASE_ARGS, mode: 'locator', locatorInput: 'IO85vs' });
      expect(target?.lat).toBeCloseTo(expected.lat, 6);
      expect(target?.lon).toBeCloseTo(expected.lon, 6);
      expect(target?.source).toBe('locator');
    });

    it('returns null for an invalid locator', () => {
      expect(
        resolveTarget({ ...BASE_ARGS, mode: 'locator', locatorInput: 'not-a-locator' }),
      ).toBeNull();
    });

    it('returns null for an empty locator', () => {
      expect(resolveTarget({ ...BASE_ARGS, mode: 'locator', locatorInput: '' })).toBeNull();
    });
  });

  describe('address mode', () => {
    it('resolves a geocoded result', () => {
      const target = resolveTarget({
        ...BASE_ARGS,
        mode: 'address',
        geocodedCoords: { lat: 40.7, lon: -74.0 },
        geocodedLabel: 'New York, NY',
      });
      expect(target).toEqual({ lat: 40.7, lon: -74.0, label: 'New York, NY', source: 'address' });
    });

    it('returns null when no geocode has resolved yet', () => {
      expect(resolveTarget({ ...BASE_ARGS, mode: 'address' })).toBeNull();
    });

    it('does not fall back to a stale result -- a failed geocode is represented by null geocodedCoords', () => {
      // Simulates the caller clearing its own state on GeocodeError before
      // calling resolveTarget again -- see TargetPicker.tsx's handler.
      const stale = resolveTarget({
        ...BASE_ARGS,
        mode: 'address',
        geocodedCoords: { lat: 1, lon: 1 },
        geocodedLabel: 'stale',
      });
      expect(stale).not.toBeNull();
      const afterFailure = resolveTarget({ ...BASE_ARGS, mode: 'address', geocodedCoords: null });
      expect(afterFailure).toBeNull();
    });
  });
});
