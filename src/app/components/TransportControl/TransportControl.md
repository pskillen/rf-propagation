# TransportControl

Persistent play/pause/speed/scrub control for `Conditions.atMs` (F7.1,
phase 10's Slice 1). Mounted once in `AppChrome`'s `transportControl`
slot — not inside any one surface — so it's present on every routed
surface (Reach, Path, Timeline, Explore) without per-surface wiring.

## Props

| Prop               | Type                            | Notes                                                                                      |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------ |
| `atMs`             | `number`                        | The shared clock's current instant.                                                        |
| `playback`         | `PlaybackState`                 | `{ playing, speedMultiplier, unrealismUnlocked }` — see `src/app/state/playback.ts`.       |
| `onAtMsChange`     | `(atMs: number) => void`        | Called every animation frame while playing, and by the scrub slider's manual drags.        |
| `onPlaybackChange` | `(next: PlaybackState) => void` | Called on play/pause toggle, speed selection, and (internally) to pause on a manual scrub. |

## Behaviour

- **Play/pause** toggles `playback.playing`.
- **Speed selector** — four fixed speeds (`PLAYBACK_SPEED_OPTIONS` in
  `src/app/state/playback.ts`), labelled `0.25×`/`1×`/`4×`/`24×`. Each
  speed is a `hoursPerSecond` value — hours of simulated time advanced
  per second of real playback. See that file's own doc comment for the
  concrete numbers and the reasoning behind them (a judgment call, not a
  spec value).
- **Driving the clock** — a `requestAnimationFrame` loop while
  `playback.playing`, calling `onAtMsChange(atMs + frameDeltaMs *
speedMultiplier * 3600)` each frame (`playbackFrameDeltaMs`, same
  module). rAF pauses automatically when the tab isn't visible — no
  timer of this component's own, no surprise catch-up jump on return.
  The per-frame real delta is capped at 250ms so a single slow/backgrounded
  frame can't translate into one giant `atMs` jump.
- **Yields to interaction** — the scrub slider's own manual drag pauses
  playback first (`onPlaybackChange({ ..., playing: false })`), then
  scrubs, exactly the same pattern `ReachPage`'s station-marker drag and
  the globe's Display-panel sliders use (pausing playback themselves
  before calling through to the shared `atMs` setter).
- **Reuses the coarse pass "for free"** — this component does not call
  `computeCoverage` itself. It only changes `atMs` once per frame; Reach's
  (`useReachCoverage`) and Globe's already-reactive recompute effects pick
  that up the same way they already react to a manual scrub or drag,
  and phase 4's `CoverageGridClient` cancel-on-supersede contract means a
  rapid run of playback ticks naturally settles to "one fine result per
  settled frame" without any playback-specific cancellation logic here.

## Known gaps

- **rAF playback cannot be exercised in this repo's browser-automation
  tooling** — automated tabs render backgrounded/hidden, and
  `requestAnimationFrame` never fires in a hidden tab (standard browser
  behaviour, not specific to this component). Verified instead via
  `TransportControl.test.tsx`, which mocks `requestAnimationFrame`
  directly and asserts the exact per-frame delta math; the
  scrub-pauses-playback and reactive-recompute paths (which don't depend
  on rAF) were confirmed live in a real `npm run dev` tab.
