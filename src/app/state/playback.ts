/**
 * `ViewerState.playback` (F7.1–F7.3, phase 10) — the transport control's
 * play/pause/speed state plus the realism-unlock flag (F7.3, Slice 3).
 * Grouped in one object per the plan file's copy of
 * `ux-and-ia.md §6`'s state model: `playback: { playing, speed,
 * unrealismUnlocked }`. `speedMultiplier` here is this file's own name
 * for "speed" — a plain number wasn't self-describing enough to leave
 * unnamed.
 */
export interface PlaybackState {
  playing: boolean;
  /** Hours of simulated time advanced per second of real playback — see `PLAYBACK_SPEED_OPTIONS`. */
  speedMultiplier: number;
  unrealismUnlocked: boolean;
}

/**
 * Judgment call, flagged (phase 10's own Slice 1, not a spec value): four
 * fixed speeds, labelled the way a video player's speed menu would be,
 * not literally "N hours/sec" (the AC only asks for "fast enough that a
 * 24-hour day/night cycle completes in ~60 seconds at the fastest
 * setting, slow enough at the slowest that the terminator's sweep is
 * readable" — it does not ask for the label to equal the underlying
 * hours/sec value). Chosen empirically in `npm run dev`: `1×`'s
 * `hoursPerSecond` (0.4) is the one that satisfies "~60s for a 24h cycle"
 * literally (24 / 0.4 = 60); the other three scale proportionally to the
 * `×` label (0.25×, 4×, 24× of the `1×` baseline), so a 24h cycle takes
 * ~240s/~15s/~2.5s respectively. See this phase's PR description for the
 * full reasoning, including where this deviates from the plan file's own
 * suggested-but-internally-inconsistent example values.
 */
export interface PlaybackSpeedOption {
  label: string;
  hoursPerSecond: number;
}

export const PLAYBACK_SPEED_OPTIONS: readonly PlaybackSpeedOption[] = [
  { label: '0.25×', hoursPerSecond: 0.1 },
  { label: '1×', hoursPerSecond: 0.4 },
  { label: '4×', hoursPerSecond: 1.6 },
  { label: '24×', hoursPerSecond: 9.6 },
];

export const DEFAULT_PLAYBACK_SPEED_MULTIPLIER = PLAYBACK_SPEED_OPTIONS[1].hoursPerSecond; // 1×

export const DEFAULT_PLAYBACK: PlaybackState = {
  playing: false,
  speedMultiplier: DEFAULT_PLAYBACK_SPEED_MULTIPLIER,
  unrealismUnlocked: false,
};

/** Simulated milliseconds advanced for one real-time animation frame. */
export function playbackFrameDeltaMs(realFrameDeltaMs: number, speedMultiplier: number): number {
  // speedMultiplier is hours-of-sim-time per second-of-real-time; hours ->
  // ms is *3_600_000, and dividing by 1000ms-real-per-second converts the
  // per-second rate to a per-ms-of-real-frameDelta rate, i.e. *3600 net.
  return realFrameDeltaMs * speedMultiplier * 3600;
}
