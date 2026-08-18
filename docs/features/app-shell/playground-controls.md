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

## Slice 4 — Permalink (F7.4)

**A gap found while wiring this, not assumed.** Before this slice,
nothing in the app actually wrote a COMPLETE `ViewerUrlState` anywhere:
`ConditionsBar`'s own url-write effect only ever wrote the two fields it
owns (`conditions`/`bandId`) on top of whatever was already in the
address bar; Station never wrote to the URL live at all (localStorage
only); target/globe-toggle changes only ever wrote `ViewerState`, never
the URL. Worse: `stationFieldCodec` could already DECODE a Station
override from a URL, but `ViewerStateProvider`'s `initialViewerState`
never applied the decoded value to anything — a shared link's Station
override silently did nothing. Both gaps are closed here, since this is
the first slice that actually needs the full round-trip to work.

**Building the permalink.** `viewerStateToUrlState` (new,
`src/app/lib/urlState/fromViewerState.ts`) maps the CURRENT, complete
`ViewerState` into a `ViewerUrlState` fresh, every time — not a read of
whatever partial state happens to be in the router. Every field omits
itself when it matches the corresponding default (shorter URLs for an
unmodified scenario), the same "override only" contract every field
codec's own `encode` already follows. `ShareButton` calls
`encodeViewerUrlState(viewerStateToUrlState(state))`, builds a full URL
from `window.location.origin` + `pathname` + the encoded params, and
copies it via `navigator.clipboard.writeText`, swapping its own icon/
label to "Link copied" for ~2s as confirmation (no toast component
exists in this kit yet).

**Applying a station override on load.** `applyStationUrlOverrides`
(new, in `viewerState.tsx`) layers `qlat`/`qlon`/`pwr`/`noise` directly
onto the loaded-or-default `Station`, recomputing the locator to stay
consistent with overridden coordinates. `ant` (the active antenna's
pattern family) is the lossiest field, per `StationUrlState`'s own doc
comment ("enough to reconstruct a PLAUSIBLE antenna," not the exact
one): this looks for an antenna already in the array with a matching
`family` and activates THAT one first. **CORRECTED IN SLICE 5:** with no
match, this originally dropped the override silently; Slice 5's own
presets need a SPECIFIC family (e.g. a vertical) to actually take effect
for a first-time visitor whose only saved antenna is the default dipole,
so `applyStationUrlOverrides` now synthesizes a plausible new antenna for
the requested family instead (`synthesizeAntennaForFamily` — sensible
default height/gain, since none travels in the URL) and appends it,
active. A malformed `ant` value that isn't one of the four real pattern
families is still silently dropped, not a crash.

**Realism-unlock round-trips too.** `playbackFieldCodec` (new field
codec, `ru` param) carries `playback.unrealismUnlocked` — the one field
`playback` actually persists (`playing`/`speedMultiplier` never do, per
Slice 1). `initialViewerState` applies it the same way every other field
does (`?? DEFAULT_PLAYBACK.unrealismUnlocked`).

**"A link from an older version loads with sane defaults" (F7.4's own
AC):** verified at this slice's own boundary, not just trusted from
phase 5 — `codec.test.ts` decodes a query string with no `playback` key
at all (an "older version" stand-in) and asserts it degrades to
`{ unrealismUnlocked: undefined }` rather than throwing, exercising the
exact mechanism (`decodeViewerUrlState`'s per-field defaulting) a real
old link would hit.

**Verified live** (`npm run dev`): set TX power to 400 W, click
"Copy share link," open the copied URL fresh — TX power shows 400 W.
Separately, opening a URL with `?ru=1` shows the realism-unlock toggle
already on.

## Slice 5 — Preset starting points (F7.5)

**Where.** `src/app/state/presets.ts` — `PRESETS`, four canned
`ViewerUrlState` objects. `PresetMenu` (Mantine `Menu`, same header
placement as Reset/Share) renders each as a plain `<a href>` built from
`encodeViewerUrlState(preset.urlState)` — clicking one is a REAL browser
navigation, the exact same "decode on mount" path
`ViewerStateProvider`'s `initialViewerState` already uses for any shared
link. No second live-apply mechanism exists or is needed: "each is a
permalink internally" (F7.5's own AC) is true by construction, not by
convention.

**Concrete preset list**, grounded in
`src/core/domain/propagation/validation.test.ts`'s own worked examples
(V14/V16/V17) rather than the prose in `physics-and-fidelity.md` §6,
since the test file has the exact numeric inputs each anchor actually
asserts against:

| Preset             | Band | Range                                         | SFI/Kp  | Antenna        | Time                                           | Grounded in                                                 |
| ------------------ | ---- | --------------------------------------------- | ------- | -------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Textbook skip zone | 20 m | ~200 km (200 km due north of the default QTH) | 120 / 2 | Vertical       | 2026-06-21 12:00 UTC (daytime)                 | V17 — target sits in the skip zone                          |
| NVIS setup         | 40 m | ~200 km (200 km due east)                     | 120 / 2 | Low dipole     | 2026-06-21 12:00 UTC (midday)                  | V16 — Good, no skip zone inside 400 km                      |
| Band above its MUF | 10 m | ~3000 km (3000 km due south)                  | 70 / 2  | Default dipole | 2026-06-21 00:00 UTC (night)                   | V14 — escapes / Unlikely, above MUF                         |
| Greyline path      | 20 m | London → Tokyo (~9600 km)                     | 120 / 2 | Default dipole | 2026-03-20 18:00 UTC (~London sunset, equinox) | Invented for this phase — no committed worked anchor exists |

Station/target coordinates and exact timestamps are this phase's own
reasonable approximation of each scenario — the validation harness
anchors `frequencyMhz`/`totalGroundRangeKm`/`sfi`/`solarZenithDeg`
directly, not a specific lat/lon pair or wall-clock instant; picking one
that plausibly produces daytime/night at the right places is a judgment
call, documented in `presets.ts`'s own doc comment, not a re-derivation
of the engine's exact solar-zenith inputs.

**A correction this slice needed, not just Slice 4's:** the first three
presets specify a NON-dipole antenna (vertical, low dipole — a first-time
visitor's only saved antenna is the default 40 m dipole). Slice 4's own
`applyStationUrlOverrides` silently dropped an `ant` override with no
matching family in the array — fine for a general permalink (lossy edge,
documented), but it meant a preset's own stated antenna type would
silently NOT apply for most visitors. Fixed by extending that function
to synthesize a plausible antenna for the family when none matches
(`synthesizeAntennaForFamily`), rather than special-casing presets with
their own separate apply path.

**"No steps, no narration, no next button"** (F7.5's own AC, and the
plan file's own named anti-pattern): nothing here has a step counter or
sequencing state to begin with — a plain `<a href>` list has no state of
its own between "closed" and "navigated away."

**Verified live** (`npm run dev`): opening the menu and selecting
"Textbook skip zone" lands on 20 m @ 14.175 MHz · SFI 120 · Kp 2 ·
Manual, a target ~200 km north, and the antenna summary showing
"omnidirectional-vertical (from link) @ 7 m" — confirming the synthesized
antenna both applied and is now the active one.

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
- **The permalink's `surface` param doesn't drive navigation.** Per
  `AppChrome`'s own doc comment (phase 5), `surface`/routing is entirely
  pathname-driven; a shared link's `s` param is decoded into
  `ViewerState.surface` but nothing reads that field to navigate.
  `ShareButton` sidesteps this by building the share URL from the
  CURRENT `window.location.pathname` (so the recipient lands on the
  right route regardless), but a hand-edited `s` param on an otherwise
  cross-surface link would not, by itself, navigate anywhere — unchanged
  from phase 5, not a regression introduced here.
