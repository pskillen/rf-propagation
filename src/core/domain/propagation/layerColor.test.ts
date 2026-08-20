import { describe, expect, it } from 'vitest';
import { colorForLayer, LAYER_IDS_INNER_TO_OUTER } from './layerColor';

describe('colorForLayer', () => {
  it('matches the ported mk1 palette exactly', () => {
    expect(colorForLayer('D')).toBe('#ff6b6b');
    expect(colorForLayer('E')).toBe('#f5c451');
    expect(colorForLayer('F1')).toBe('#3ddc97');
    expect(colorForLayer('F2')).toBe('#5ec8ff');
  });
});

describe('LAYER_IDS_INNER_TO_OUTER', () => {
  it('is D, E, F1, F2 in that order', () => {
    expect(LAYER_IDS_INNER_TO_OUTER).toEqual(['D', 'E', 'F1', 'F2']);
  });
});
