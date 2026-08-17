import type { NoiseEnvironment } from '@core/domain/propagation/noise';

export type SurfaceId = 'reach' | 'path' | 'timeline' | 'explore';

/**
 * The URL's lossy view of `Station` (`@core/domain/station/types`): QTH
 * coordinates, the active antenna's pattern family, power and noise
 * environment round-trip; the full antenna array and antenna
 * names/heading/gain do not — a full antenna library in a query string is
 * heavier than a shareable permalink needs (see fields/station.ts). Every
 * field is an optional *override* — absent means "use the app's own
 * current/default Station value," not a numeric default of its own, which
 * is why `DEFAULT_VIEWER_URL_STATE.station` below is `{}` rather than a
 * populated station.
 */
export interface StationUrlState {
  qlat?: number;
  qlon?: number;
  /** Active antenna's pattern family — enough to reconstruct a plausible antenna. */
  ant?: string;
  pwr?: number;
  noise?: NoiseEnvironment;
}

/**
 * Grows by one optional-in-spirit field per phase (phase 6 adds `station`,
 * phase 7 adds `conditions` and `bandId`, etc. — see ux-and-ia.md §6 for the
 * eventual full shape). Each addition is a new property on this interface
 * plus a new field-codec module registered in codec.ts's FIELD_CODECS array
 * — never a change to an existing property or an existing field-codec's logic.
 */
export interface ViewerUrlState {
  surface: SurfaceId;
  station: StationUrlState;
}

export const URL_STATE_VERSION = 1;

export const DEFAULT_VIEWER_URL_STATE: ViewerUrlState = {
  surface: 'reach',
  station: {},
};
