import { coordsToLocator } from '../maidenhead';
import type { Station } from './types';

// Judgment call, flagged: a fixed, plausible default QTH — neither the
// design docs nor the ticket specify a location. bandCatalog.ts's amateur
// allocations (ported in phase 7) are UK Ofcom-sourced, so a UK default
// keeps the rest of the app's assumptions consistent. Coordinates are
// central England (Birmingham); the locator is computed programmatically
// below at module-load time rather than hand-written, to avoid
// transcription error.
export const DEFAULT_QTH_LAT = 52.4862;
export const DEFAULT_QTH_LON = -1.8904;

/**
 * The populated, already-interesting station a first-time visitor sees —
 * no wizard, no empty state, no modal (F4.5). Deliberately mirrors
 * ux-and-ia.md §3's own worked example of the mobile Station bar summary
 * — "GM4XYZ · IO75 · 40m dipole @ 7 m · 100 W" — verbatim: 40m dipole, 7m
 * height, 100W.
 */
export const DEFAULT_STATION: Station = {
  qth: {
    lat: DEFAULT_QTH_LAT,
    lon: DEFAULT_QTH_LON,
    locator: coordsToLocator(DEFAULT_QTH_LAT, DEFAULT_QTH_LON),
    source: 'default',
  },
  antennas: [
    {
      id: 'default-dipole',
      name: '40m dipole',
      family: 'bidirectional-transverse',
      heightM: 7,
      gainDbi: 2.1, // judgment call — a typical free-space half-wave dipole figure
    },
  ],
  activeAntennaId: 'default-dipole',
  powerW: 100,
  noiseEnvironment: 'rural', // judgment call — not sourced from any doc
};
