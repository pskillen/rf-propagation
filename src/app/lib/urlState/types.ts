import type { NoiseEnvironment } from '@core/domain/propagation/noise';
import type { GroundType } from '@core/domain/propagation/losses';
import type { ConditionsDriverKind } from '@core/domain/conditions/types';

export type SurfaceId = 'reach' | 'path' | 'timeline' | 'explore' | 'compare';

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
 * The URL's lossy view of `ViewerState.target` (`@app/state/viewerState`).
 * `label`/`source` don't round-trip: `label` is a display-only convenience
 * (re-derivable, not load-bearing for what the target IS), and `source`
 * is always `'map-click'` for anything this phase's codec can produce —
 * Path's own target picker (phase 13) is expected to widen this codec
 * when it adds sources a shared link actually needs to distinguish.
 * Absent (`undefined`) means "no target" (`ViewerState.target === null`),
 * matching `StationUrlState`/`ConditionsUrlState`'s own "absent means
 * default" convention.
 */
export interface TargetUrlState {
  lat: number;
  lon: number;
}

/**
 * The URL's lossy view of `ViewerState.display.globeToggles`
 * (`@app/state/globeToggles`, phase 9's Slice 2, F6.2's own "settings
 * persist and are registered with the URL codec" AC). Every field is an
 * optional override, same "absent means the app's own current/default
 * value" contract as `StationUrlState`/`ConditionsUrlState` — hence
 * `DEFAULT_VIEWER_URL_STATE.globe` below is `{}`, not a populated
 * `GlobeToggles`.
 */
export interface GlobeUrlState {
  exaggerationFactor?: number;
  explodeEnabled?: boolean;
  fresnelEnabled?: boolean;
  terminatorEnabled?: boolean;
  cutawayEnabled?: boolean;
  mapMode?: 'map' | 'globe';
}

/**
 * The URL's lossy view of `ViewerState.display.rayControls`
 * (`@app/state/rayControls`, phase 11's Slices 2-3, F8.2/F8.3). Every field
 * an optional override, same "absent means the app's own current/default
 * value" contract as `GlobeUrlState`. `esMin`/`esMax` split
 * `elevationSpreadDeg`'s tuple into two params since a single query key
 * can't hold a two-element array cleanly with this codec's flat
 * key/value convention.
 */
export interface ExploreUrlState {
  radials?: number;
  elevations?: number;
  esMin?: number;
  esMax?: number;
  focusBearingDeg?: number;
  outcomeFilter?: 'all' | 'escaped' | 'returned' | 'absorbed';
  colourBy?: 'mode' | 'layer' | 'signalStrength';
  soloLayerId?: 'D' | 'E' | 'F1' | 'F2';
}

/**
 * The URL's lossy view of `ViewerState.playback` (`@app/state/playback`,
 * phase 10's Slice 4, F7.4). Only `unrealismUnlocked` round-trips —
 * `playing`/`speedMultiplier` are deliberately never persisted anywhere
 * (see `playback.ts`'s own doc comment: "nobody wants to reopen the tab
 * into a running animation"), so there is nothing else for this codec to
 * carry. Absent means "locked" (`DEFAULT_PLAYBACK.unrealismUnlocked ===
 * false`), same "absent means default" convention as every other field
 * codec here.
 */
export interface PlaybackUrlState {
  unrealismUnlocked?: boolean;
}

/**
 * The URL's lossy view of `ViewerState.compare` (`@core/domain/propagation/
 * compareScenario`'s `CompareState`, F9.1, phase 12). Every field an
 * optional override, same "absent means the app's own current/default
 * value" contract as every other field codec here.
 */
export interface CompareUrlState {
  enabled?: boolean;
  againstAntennaId?: string;
  againstBandId?: string;
  againstAtMs?: number;
}

/**
 * Grows by one optional-in-spirit field per phase (phase 6 adds `station`,
 * phase 7 adds `conditions` and `bandId`, phase 8 adds `target`, phase 9
 * adds `globe`, phase 10 adds `playback`, phase 12 adds `compare`, etc. —
 * see ux-and-ia.md §6 for the eventual full shape). Each addition is a new
 * property on this interface plus a new field-codec module registered in
 * codec.ts's FIELD_CODECS array — never a change to an existing property
 * or an existing field-codec's logic.
 */
export interface ViewerUrlState {
  surface: SurfaceId;
  station: StationUrlState;
  conditions: ConditionsUrlState;
  bandId: string;
  target?: TargetUrlState;
  globe: GlobeUrlState;
  playback: PlaybackUrlState;
  explore: ExploreUrlState;
  compare: CompareUrlState;
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
  globe: {},
  playback: {},
  explore: {},
  compare: {},
};
