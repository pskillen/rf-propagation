/**
 * Plain-language definitions for the jargon Explore's own labels surface
 * (F8.4, [#66]) — UI copy, not domain logic, so this lives in the `app`
 * layer per the layer-boundary rule (this is English, not physics).
 *
 * The wording below is a first draft to unblock implementation, per this
 * phase's own plan file ("adjust for tone/accuracy against
 * physics-and-fidelity.md and feature-description.md §2's fixed
 * vocabulary; the mechanism is the load-bearing part of this slice, not
 * the copy").
 *
 * [#66]: https://github.com/pskillen/rf-propagation/issues/66
 */
export type TermKey =
  | 'muf'
  | 'foF2'
  | 'takeoffAngle'
  | 'snrMargin'
  | 'layerD'
  | 'layerE'
  | 'layerF1'
  | 'layerF2'
  | 'reliability'
  | 'skipZone'
  | 'groundwave';

export interface TermDefinitionEntry {
  label: string;
  definition: string;
}

export const TERM_DEFINITIONS: Record<TermKey, TermDefinitionEntry> = {
  muf: {
    label: 'MUF',
    definition:
      'Maximum Usable Frequency — the highest frequency that reflects back to the ground on this path, right now. Above it, a signal punches through into space instead of coming back down.',
  },
  foF2: {
    label: 'foF2',
    definition:
      "The F2 layer's own critical frequency — the highest frequency it reflects straight up (vertical incidence). Off-vertical paths can use higher frequencies than this, up to the MUF.",
  },
  takeoffAngle: {
    label: 'Takeoff angle',
    definition:
      'The angle above the horizon a signal leaves the antenna at. Low angles (a few degrees) travel further per hop; high angles (near vertical) are what NVIS needs for close-in coverage.',
  },
  snrMargin: {
    label: 'SNR margin',
    definition:
      'How far the signal sits above the noise floor, in dB, compared with what a mode needs to be readable. Positive is good; the bigger the number, the more comfortable the copy.',
  },
  layerD: {
    label: 'D layer',
    definition:
      'The lowest ionospheric layer (~90km up). It never reflects HF — it only absorbs, and only in daylight. This is why low bands are noisy/dead by day and come alive after dark.',
  },
  layerE: {
    label: 'E layer',
    definition:
      'A middle layer (~110km up) that reflects mid-HF frequencies, mostly by day. Sporadic-E aside (not modelled here), it fades toward its night floor after dark.',
  },
  layerF1: {
    label: 'F1 layer',
    definition:
      'A daytime-only layer (~200km up) that merges into F2 after dark — this is why F1 disappears from the picture at night rather than just weakening.',
  },
  layerF2: {
    label: 'F2 layer',
    definition:
      "The workhorse HF reflector (~300km by day, ~350km by night). It's active around the clock, which is why long-distance HF contacts are usually an F2 story.",
  },
  reliability: {
    label: 'Reliability',
    definition:
      'A day-to-day probability estimate that combines two things: whether the MUF stays above the operating frequency, and whether the signal-to-noise margin holds for the chosen mode — not a guarantee for this exact moment.',
  },
  skipZone: {
    label: 'Skip zone',
    definition:
      'The gap between where groundwave fades out and where the first sky-wave hop lands. Nothing is heard here — not because nothing was checked, but because the signal genuinely skips over it.',
  },
  groundwave: {
    label: 'Groundwave',
    definition:
      'The part of the signal that travels along the ground rather than bouncing off the ionosphere — short range, no reflection involved.',
  },
};
