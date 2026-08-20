import { DEFAULT_VIEWER_URL_STATE, URL_STATE_VERSION, type ViewerUrlState } from './types.ts';
import { surfaceFieldCodec } from './fields/surface.ts';
import { stationFieldCodec } from './fields/station.ts';
import { conditionsFieldCodec } from './fields/conditions.ts';
import { bandFieldCodec } from './fields/band.ts';
import { targetFieldCodec } from './fields/target.ts';
import { globeFieldCodec } from './fields/globe.ts';
import { playbackFieldCodec } from './fields/playback.ts';
import { exploreFieldCodec } from './fields/explore.ts';
import { compareFieldCodec } from './fields/compare.ts';
import { timelineFieldCodec } from './fields/timeline.ts';

export interface UrlStateFieldCodec<K extends keyof ViewerUrlState> {
  key: K;
  encode(value: ViewerUrlState[K], params: URLSearchParams): void;
  decode(params: URLSearchParams, defaults: ViewerUrlState): ViewerUrlState[K];
}

// The ONLY edit later phases make to this file: append their field codec here.
// Phase 6 appends stationFieldCodec; phase 7 appends conditionsFieldCodec and
// bandFieldCodec; phase 8 appends targetFieldCodec; phase 9 appends
// globeFieldCodec; phase 10 appends playbackFieldCodec; phase 11 appends
// exploreFieldCodec; phase 12 appends compareFieldCodec; phase 14 appends
// timelineFieldCodec. Each codec's own
// encode/decode logic lives in its own file under ./fields/ and is written
// once.
//
// A heterogeneous registry of per-key codecs has no key-safe element type in
// TypeScript's structural system (each codec's encode parameter is
// contravariant in its own key's value type) — `any` here is the standard,
// deliberate escape hatch for that, not a typing shortcut.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FIELD_CODECS: UrlStateFieldCodec<any>[] = [
  surfaceFieldCodec,
  stationFieldCodec,
  conditionsFieldCodec,
  bandFieldCodec,
  targetFieldCodec,
  globeFieldCodec,
  playbackFieldCodec,
  exploreFieldCodec,
  compareFieldCodec,
  timelineFieldCodec,
];

export function encodeViewerUrlState(state: ViewerUrlState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('v', String(URL_STATE_VERSION));
  // `FIELD_CODECS` is deliberately `UrlStateFieldCodec<any>[]` (see above) so
  // later phases can append codecs for different keys to one array without
  // widening its element type each time — that erases key-to-value linkage
  // at this loop's call sites, hence the record cast rather than a plain
  // `state[codec.key]` index (which strict mode rejects as an implicit-any
  // index; each field codec's own file keeps full key/value type safety).
  const record = state as unknown as Record<string, unknown>;
  for (const codec of FIELD_CODECS) codec.encode(record[codec.key], params);
  return params;
}

export function decodeViewerUrlState(params: URLSearchParams): ViewerUrlState {
  const versionRaw = params.get('v');
  const version = versionRaw ? Number(versionRaw) : URL_STATE_VERSION;
  if (!Number.isFinite(version) || version > URL_STATE_VERSION) {
    // Unknown/future version, or malformed — degrade to defaults rather than
    // guessing at a shape we don't understand. A stale shared link must still load.
    return { ...DEFAULT_VIEWER_URL_STATE };
  }
  const state: ViewerUrlState = { ...DEFAULT_VIEWER_URL_STATE };
  const record = state as unknown as Record<string, unknown>;
  for (const codec of FIELD_CODECS) {
    record[codec.key] = codec.decode(params, DEFAULT_VIEWER_URL_STATE);
  }
  return state;
}
