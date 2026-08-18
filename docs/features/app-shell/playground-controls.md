# Playground controls

## Purpose

Discrete UI a playground needs beyond "things already respond": a
transport control that drives time itself, a reset button, a
realism-unlock toggle, a share link, and a preset menu (F7.1–F7.5, phase
10). Not covered here: the _architectural_ mechanics that make direct
manipulation feel live (continuous drag response) — those are standing
constraints built into each surface as it lands (Reach's marker drag,
phase 8; the globe's shell sliders, phase 9), not part of this phase.

## Code anchors

- `src/app/components/TransportControl/TransportControl.tsx` — the
  play/pause/speed/scrub control; see its own sidecar,
  `TransportControl.md`, for props and behaviour.
- `src/app/state/playback.ts` — `PlaybackState`, `PLAYBACK_SPEED_OPTIONS`,
  `DEFAULT_PLAYBACK`, `playbackFrameDeltaMs`.
- `src/app/state/viewerState.tsx` — `ViewerState.playback`; see this
  file's phase-10 CORRECTION doc comment for how `Conditions.atMs`
  ownership changed (lifted out of `ConditionsBar` into `App.tsx`'s
  `Shell`, shared with `TransportControl`).
- `src/app/App.tsx` — `Shell`, where the shared `useConditions()` clock is
  instantiated once.
- `src/app/components/conditions/ConditionsBar.tsx` — now takes
  `atMs`/`liveNow`/`onScrub`/`onGoLive` as props instead of owning the
  clock itself.

## Slice 1 — Transport control and time-lapse (F7.1)

**Mounting.** `TransportControl` fills a third persistent chrome slot on
`AppChrome` (`transportControl`, alongside `stationBar`/`conditionsBar`),
mounted once in `App.tsx`'s `Shell` — not inside any one surface's own
component tree. This is what makes "works on every surface" true by
construction: `AppChrome.test.tsx` fixtures the chrome with different
`children` (stand-ins for each routed surface) and asserts the
transport-control slot's content is unaffected.

**Shared clock.** Before this phase, `ConditionsBar` owned
`useConditions()` (the `atMs`/`liveNow` state) as internal component
state, published one-way into `ViewerState.conditions`. The transport
control is a _second_ writer of `atMs`, and it lives outside
`ConditionsBar` — so the clock moved up to `App.tsx`'s `Shell`,
instantiated once, and both `ConditionsBar` and `TransportControl` now
receive `atMs`/`liveNow`/`onScrub` (or `onAtMsChange`)/`onGoLive` as
props. `driver`/`ground`/`bandId`/`frequencyMhz` are unaffected — still
`ConditionsBar`-local, still published one-way, since nothing outside
that component writes them (yet).

**Speed.** `PLAYBACK_SPEED_OPTIONS` — four fixed speeds, `hoursPerSecond`
of simulated time per second of real playback:

| Label   | `hoursPerSecond` | A 24h day/night cycle takes |
| ------- | ---------------- | --------------------------- |
| `0.25×` | 0.1              | ~240s (4 min)               |
| `1×`    | 0.4              | ~60s                        |
| `4×`    | 1.6              | ~15s                        |
| `24×`   | 9.6              | ~2.5s                       |

Judgment call, not a spec value (see `playback.ts`'s own doc comment):
the plan file's own suggested example (`[0.25×, 1×, 4×, 24×]` labelled
against literal `N hours/sec`) is internally inconsistent — at a literal
24 hours/sec, a 24h cycle completes in ~1s, not the "~60 seconds at the
fastest setting" the same paragraph also asks for. This phase instead
picked `hoursPerSecond` values that scale proportionally to the `×`
label, with `1×` landing on the "~60s for a 24h cycle" AC literally.

**Driving the clock.** A `requestAnimationFrame` loop, while
`playback.playing`, calls `onAtMsChange(atMs + playbackFrameDeltaMs(
frameDeltaMs, speedMultiplier))` every frame — `playbackFrameDeltaMs`
converts hours-per-second-of-real-time into simulated milliseconds for
one real animation frame. rAF pauses automatically when the tab isn't
visible (no surprise catch-up jump on return); the per-frame real delta
is capped at 250ms so one slow/backgrounded frame can't translate into
one giant `atMs` jump either.

**Reuses the coarse pass "for free."** This control never calls
`computeCoverage` itself — it only changes `atMs`. Reach's
`useReachCoverage` and the globe's own shell-geometry `useMemo` are
already reactive to `Conditions.atMs` (phases 8/9), and phase 4's
`CoverageGridClient` already cancels/supersedes a stale in-flight
request when a newer one arrives — so a playback tick's rapid run of
`computeCoverage` calls naturally settles to "one fine result per
settled frame" with no playback-specific cancellation logic anywhere in
this phase's code.

**Yields to interaction.** A manual scrub — this control's own slider,
`ConditionsBar`'s `TimeScrubber`, a Reach station-marker drag, or a
globe Display-panel slider — pauses playback first
(`playback.playing → false`) before applying the change, rather than
fighting the animation loop for control of `atMs`. `ConditionsBar`'s
`onScrub`/`onGoLive` (passed down from `Shell`) are wrapped locally to
pause first; `ReachPage`'s `handleStationDrag`/`handleGlobeTogglesChange`
do the same directly against `ViewerState.playback`.

**Verified live** (`npm run dev`): a manual scrub via the transport
control's own slider updates Reach's coverage summary (`Best band now`)
reactively and correctly stops an active playback session. Actual
`requestAnimationFrame`-driven playback could not be exercised through
this repo's browser-automation tooling — automated tabs render
backgrounded/hidden, and `requestAnimationFrame` never fires at all in a
hidden tab (standard browser behaviour). The frame-delta math and the
pause-on-interaction behaviour are covered instead by
`TransportControl.test.tsx`, which mocks `requestAnimationFrame`
directly.

## Known gaps

- **No dedicated `ReachPage`-level integration test for
  drag-pauses-playback.** The underlying pattern (pause first, then
  apply) is unit-tested against `TransportControl`'s own scrub slider;
  `ReachPage`'s station-drag and globe-toggle-change handlers apply the
  identical two-line pattern directly against `ViewerState.playback`,
  reviewed but not independently integration-tested, given this phase's
  time budget.
