import { describe, expect, it } from 'vitest';
import { formatLatLon } from './formatLatLon.ts';

describe('formatLatLon', () => {
  it('formats a northern/western coordinate', () => {
    expect(formatLatLon(51.2, -3.1)).toBe('51.2°N 3.1°W');
  });

  it('formats a southern/eastern coordinate', () => {
    expect(formatLatLon(-33.87, 151.21)).toBe('33.9°S 151.2°E');
  });

  it('treats zero as the positive hemisphere (N/E)', () => {
    expect(formatLatLon(0, 0)).toBe('0.0°N 0.0°E');
  });
});
