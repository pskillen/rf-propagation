import type { UrlStateFieldCodec } from '../codec.ts';

function parseBoolean(raw: string | null): boolean | undefined {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return undefined;
}

/**
 * Playback URL codec (F7.4, phase 10's Slice 4) — a single override,
 * `unrealismUnlocked`, same "absent means the app's own current/default
 * value" contract every other field codec here uses. `ru` ("realism
 * unlocked") kept short, same convention as the globe toggles' `g*`
 * params.
 */
export const playbackFieldCodec: UrlStateFieldCodec<'playback'> = {
  key: 'playback',
  encode(value, params) {
    if (value.unrealismUnlocked !== undefined) {
      params.set('ru', value.unrealismUnlocked ? '1' : '0');
    }
  },
  decode(params, defaults) {
    return {
      unrealismUnlocked: parseBoolean(params.get('ru')) ?? defaults.playback.unrealismUnlocked,
    };
  },
};
