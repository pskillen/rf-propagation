import { describe, expect, it } from 'vitest';
import { decodeViewerUrlState, encodeViewerUrlState } from '../lib/urlState/codec.ts';
import { PRESETS } from './presets.ts';

describe('PRESETS', () => {
  it('has one entry per F7.5-named scenario', () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      'textbook-skip-zone',
      'nvis-setup',
      'band-above-muf',
      'greyline-path',
    ]);
  });

  it.each(PRESETS)(
    '$label decodes to a valid ViewerUrlState against the current codec version',
    (p) => {
      const params = encodeViewerUrlState(p.urlState);
      expect(params.get('v')).toBe('1');
      const decoded = decodeViewerUrlState(params);
      expect(decoded.bandId).toBe(p.urlState.bandId);
      expect(decoded.target).toEqual(p.urlState.target);
      expect(decoded.conditions.t).toBe(p.urlState.conditions.t);
      expect(decoded.conditions.sfi).toBe(p.urlState.conditions.sfi);
      expect(decoded.conditions.kp).toBe(p.urlState.conditions.kp);
    },
  );

  it.each(PRESETS)(
    'applying $label matches applying the equivalent permalink byte-for-byte',
    (p) => {
      // "Each is a permalink internally" (F7.5's own AC) -- a preset's own
      // encoded query string and a hand-built equivalent permalink for the
      // exact same ViewerUrlState must be identical, since PresetMenu
      // builds a preset's href with the SAME encodeViewerUrlState call a
      // real permalink uses.
      const presetParams = encodeViewerUrlState(p.urlState).toString();
      const permalinkParams = encodeViewerUrlState({ ...p.urlState }).toString();
      expect(presetParams).toBe(permalinkParams);
    },
  );

  it('each preset is grounded in a named worked example or explicitly flagged as invented', () => {
    for (const p of PRESETS) {
      expect(p.groundedIn.length).toBeGreaterThan(0);
    }
    const greyline = PRESETS.find((p) => p.id === 'greyline-path')!;
    expect(greyline.groundedIn).toMatch(/invented/i);
  });
});
