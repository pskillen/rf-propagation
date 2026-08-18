import type { NoiseEnvironment } from '@core/domain/propagation/noise';
import type { GroundType } from '@core/domain/propagation/losses';
import type { ConditionsDriverKind } from '@core/domain/conditions/types';

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
 * The URL's lossy view of `Conditions` (`@core/domain/conditions/types`).
 * `t` (atMs) is present only when `liveNow` is false — a plain link with
 * no `t` means "now", matching `DEFAULT_CONDITIONS.liveNow === true`.
 * `dk`/`sfi`/`kp` are present only when the driver is NOT `'live'` — a
 * live snapshot value isn't meaningful to encode in a shareable link
 * (the recipient's own live fetch should apply instead); `'manual'`/
 * `'preset'` values, by contrast, are exactly what a shared permalink
 * needs to reproduce. Judgment call, flagged: neither doc specifies this
 * omission rule explicitly — it mirrors `t`'s own "absent means default
 * live behaviour" pattern.
 */
export interface ConditionsUrlState {
  t?: number;
  dk?: ConditionsDriverKind;
  sfi?: number;
  kp?: number;
  gnd?: GroundType;
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
  conditions: ConditionsUrlState;
  bandId: string;
}

export const URL_STATE_VERSION = 1;

/**
 * Judgment call, flagged: `'40m'` as the default band — not specified by
 * any doc — deliberately echoes `DEFAULT_STATION`'s own default antenna
 * ("40m dipole", `@core/domain/station/defaults.ts`), so a fresh
 * visitor's default band and default antenna are the same band.
 */
export const DEFAULT_BAND_ID = '40m';

export const DEFAULT_VIEWER_URL_STATE: ViewerUrlState = {
  surface: 'reach',
  station: {},
  conditions: {},
  bandId: DEFAULT_BAND_ID,
};
