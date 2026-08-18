import { describe, expect, it } from 'vitest';
import { unwrapLongitudeRelativeTo } from './unwrapLongitude.ts';

describe('unwrapLongitudeRelativeTo', () => {
  it('leaves a value unchanged when already within 180deg of the reference', () => {
    expect(unwrapLongitudeRelativeTo(10, 5)).toBe(10);
    expect(unwrapLongitudeRelativeTo(-30, -25)).toBe(-30);
  });

  it('unwraps a value just past the antimeridian back to a continuous value', () => {
    // Reference just west of the seam, raw value just east of it having
    // been normalised to a negative longitude -- should come back positive
    // and close to the reference, not ~360deg away.
    expect(unwrapLongitudeRelativeTo(-179.8, 179.9)).toBeCloseTo(180.2, 10);
  });

  it('unwraps the opposite direction symmetrically', () => {
    expect(unwrapLongitudeRelativeTo(179.8, -179.9)).toBeCloseTo(-180.2, 10);
  });

  it('handles a reference far outside +-180 (chained/running reference)', () => {
    expect(unwrapLongitudeRelativeTo(-179.9, 180.1)).toBeCloseTo(180.1, 10);
  });
});
