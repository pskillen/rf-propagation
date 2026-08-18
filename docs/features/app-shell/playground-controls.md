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

## Slice 2 — Reset to defaults (F7.2)

**Where.** A `ResetButton` in `AppChrome`'s header, next to primary nav —
"always available" (F7.2's own AC), not behind any surface panel. All
the actual reset logic lives in `App.tsx`'s `Shell`'s `handleReset`,
since it needs the shared clock, `ViewerState`, the URL codec, and the
router all at once; `ResetButton` itself is presentational.

**What it restores**, in one `ViewerState.setState` call: `station` →
`DEFAULT_STATION` (also persisted via `saveStation`, so a reload doesn't
resurrect the pre-reset localStorage value), `conditions` →
`DEFAULT_CONDITIONS`, `bandId`/`frequencyMhz` → the default band and its
midpoint, `target` → `null`, `surface` → `'reach'` (via `navigate('/')`),
`display.globeToggles` → `DEFAULT_GLOBE_TOGGLES`, `playback` →
`DEFAULT_PLAYBACK` (stops any active playback). The shared clock resets
via `goLive()` (live "now", matching `DEFAULT_CONDITIONS.liveNow`).

**A real race, found empirically, not assumed.** The first implementation
bumped a `key` prop to force `ConditionsBar` to remount and re-seed its
own local `ground`/driver/`bandId`/`frequencyMhz` state from a
just-cleared URL. This reliably raced: `handleReset` also calls
`useViewerUrlState`'s `setState` (→ react-router's `setSearchParams`),
and the data router applies that navigation _asynchronously_ — a remount
scheduled in the same synchronous batch consistently mounted before the
URL had actually cleared, and re-seeded from the STALE (pre-reset) query
string. Fixed by giving `ConditionsBar` a `resetToken` prop instead: an
effect keyed on it resets `ground`/driver/`bandId`/`frequencyMhz`
directly to hard defaults, with no dependency on the URL's update timing
at all. `StationBar` still uses a plain `key`-based remount (safe there —
it holds no URL-derived state, only closes its own edit-panel UI).

**"No action anywhere destroys state the operator can't recover"
(F7.2's own AC, reviewed as a checklist item for this whole PR, not a
single line of code):** target selection, display toggles, and map/globe
mode (all introduced in phases 8–9) are each covered by this Reset —
none of them had a destructive, unreversible action of their own with no
undo path (no antenna-delete or similar exists yet either).

**Verified live** (`npm run dev`): starting from `/?b=20m`, clicking
Reset restores the 40 m band and its 7.1 MHz midpoint, and the URL no
longer contains `b=20m`. Covered by `App.test.tsx` (full-app integration,
since the reset logic spans the router/URL codec/`ViewerState`/clock
together) — including a `navigateTo` test helper that dispatches a
`popstate` event after `window.history.pushState`, which turned out to
be necessary for `createBrowserRouter`'s `useSearchParams()` to notice a
directly-pushed URL at all inside this test environment (its internal
history object doesn't listen for a bare `pushState`).

## Slice 3 — Realism unlock (F7.3)

**Where.** `src/app/lib/realismBounds.ts` — every locked/unlocked
`min`/`max` pair, plus a `isXOutOfRealisticBounds`/`anyInputOutOfRealisticBounds`
per field. The toggle itself (`ToggleSwitch`, labelled "Unrealistic
values (sandbox mode)") lives in `ConditionsBar`'s expanded panel — the
plan file flagged this as "the design docs don't specify exactly where;
the Conditions bar is a reasonable home since most of what it unlocks is
solar/frequency/antenna bounds," and this phase took that suggestion.
Off by default (`DEFAULT_PLAYBACK.unrealismUnlocked === false`, F7.3's
own AC).

**Concrete bounds (this phase's own judgment call, not a spec value):**

| Input          | Locked (realistic)                        | Unlocked                      |
| -------------- | ----------------------------------------- | ----------------------------- |
| SFI            | 60–300                                    | 0–500                         |
| Kp             | 0–9 (the real scale — unlock is a no-op)  | 0–9                           |
| Antenna height | 1–30 m                                    | 0.5–500 m                     |
| Frequency      | the selected band's own `minMhz`/`maxMhz` | 1–30 MHz, ignoring band edges |
| TX power       | 1–1500 W                                  | 1–100,000 W                   |

Antenna height specifically: the plan file assumed mk1's own
`MIN_HEIGHT_M`/`MAX_HEIGHT_M` had already been ported (phase 6) as this
phase's locked bound. Verified against the actual repo and that
constant does not exist — `AntennaList.tsx`'s height field has never had
bounds at all. This phase adds `MIN_ANTENNA_HEIGHT_M`/
`MAX_ANTENNA_HEIGHT_M` fresh, using the plan file's own suggested numbers
since nothing else in the repo defines a locked range to match.

**Relaxing bounds** is a per-control change, not a separate "unrealistic
mode" input path: `FrequencyField`, `ManualDriverFields` (SFI/Kp),
`PowerInput`, and `AntennaList`'s height field each take an `unlocked`
prop and switch their commit-clamp/`min`/`max` accordingly.

**Out-of-range marking:** each of those same controls marks itself (via
`FormField`'s own `error` prop — a destructive-styled border + hint)
whenever its CURRENT value sits outside the REALISTIC bound, regardless
of whether the toggle is on right now — so switching back off doesn't
retroactively make an unrealistic value look fine.

**Clamp-on-lock-off** (this phase's own concrete choice for "turning the
toggle off enforces realistic-only, doesn't just encourage it"): toggling
OFF immediately clamps any currently out-of-range value back into the
locked bound. `ConditionsBar` does this directly inside its toggle's own
`onChange` handler (frequency, and SFI/Kp when the driver is currently
`'manual'`); `StationBar` does the same in a `useEffect` keyed on the
`unrealismUnlocked` prop transitioning true → false (TX power, the
active antenna's height) — it can't hook the same click event directly,
since the toggle itself lives in a different component (`ConditionsBar`).

A `useEffect`-based version of `ConditionsBar`'s own clamp was tried
first and rejected: this repo's stricter react-hooks lint rule ("calling
setState synchronously within an effect can trigger cascading renders")
flagged it. Since the clamp only ever needs to run in direct response to
one user action (the toggle switching off), moving it into the toggle's
own handler removed the effect entirely — simpler code, and lint-clean.

**Sandbox-value disclosure** (F7.3's "every answer surface shows a 'not
the real world' state"): `ReachPage` computes one derived boolean,
`unrealismUnlocked && anyInputOutOfRealisticBounds(...)`, and shows a
`StatusBanner` ("Sandbox values in use — this scenario isn't physically
realistic.") when it's true — read by both the map and the globe view,
since both render inside this same page, rather than duplicating the
check per view.

**Verified live** (`npm run dev`): unlocking, then setting frequency to
25 MHz on the 40 m band, accepts the value, marks the field, and shows
the sandbox banner; toggling back off immediately clamps the frequency
to 7.2 MHz (the band's own max) and the banner disappears.

## Known gaps

- **No dedicated `ReachPage`-level integration test for
  drag-pauses-playback.** The underlying pattern (pause first, then
  apply) is unit-tested against `TransportControl`'s own scrub slider;
  `ReachPage`'s station-drag and globe-toggle-change handlers apply the
  identical two-line pattern directly against `ViewerState.playback`,
  reviewed but not independently integration-tested, given this phase's
  time budget.
- **Antenna height clamp-on-lock-off only covers the ACTIVE antenna.**
  A non-active antenna saved with an out-of-range height while unlocked
  keeps that value until it becomes active; scoped out of this phase
  given the time budget (no antenna-delete or per-antenna clamp sweep
  exists to model this against either).
