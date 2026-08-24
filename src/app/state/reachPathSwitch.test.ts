import { describe, expect, it } from 'vitest';
import { activeAnswerSurface } from './reachPathSwitch.ts';

describe('activeAnswerSurface', () => {
  it("returns 'reach' when target is null", () => {
    expect(activeAnswerSurface({ target: null })).toBe('reach');
  });

  it("returns 'path' for any non-null target", () => {
    expect(activeAnswerSurface({ target: { lat: 0, lon: 0, source: 'coordinates' } })).toBe('path');
  });

  it('round-trips: setting then clearing target returns to reach', () => {
    const withTarget = { target: { lat: 10, lon: 20, source: 'locator' as const } };
    expect(activeAnswerSurface(withTarget)).toBe('path');
    const cleared = { target: null };
    expect(activeAnswerSurface(cleared)).toBe('reach');
  });
});
