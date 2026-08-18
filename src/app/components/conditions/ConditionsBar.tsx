// Fills AppChrome's conditionsBar slot (phase 5's contract). Composes
// Slice 1's time model (`useConditions`/`TimeScrubber`) and Slice 2's
// fallback-chain driver (`useConditionsDriver`) into one compact/expanded
// bar, mirroring Station's `StationBar.tsx` layout convention. Always
// shows provenance next to the SFI/Kp values (F4.7,
// ux-and-ia.md §8 "Solar inputs show provenance inline") — never just on
// the live path.
import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import type { GroundType } from '@core/domain/propagation/losses';
import type { Conditions } from '@core/domain/conditions/types';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import { UK_AMATEUR_BANDS, bandMidpointMhz } from '@core/domain/bandCatalog';
import { DEFAULT_BAND_ID } from '../../lib/urlState/types.ts';
import type { ConditionsUrlState } from '../../lib/urlState/types.ts';
import { describeDriverProvenance, useConditionsDriver } from '../../hooks/useConditionsDriver.ts';
import { useViewerUrlState } from '../../hooks/useViewerUrlState.ts';
import { useViewerState } from '../../state/viewerState.tsx';
import { clamp, frequencyRange, kpRange, sfiRange } from '../../lib/realismBounds.ts';
import {
  Button,
  SegmentedControl,
  ToggleSwitch,
  type SegmentedControlOption,
} from '../v2/index.ts';
import BandChips from './BandChips.tsx';
import FrequencyField from './FrequencyField.tsx';
import ManualDriverFields from './ManualDriverFields.tsx';
import TimeScrubber from './TimeScrubber.tsx';
import classes from './ConditionsBar.module.css';

// Matches the address-search field's own debounce interval
// (`QthPicker.tsx`'s `ADDRESS_SEARCH_DEBOUNCE_MS`) — "debounce the write,
// not the render" (phase 5's own flag for this exact field, and the
// debounced-inputs skill's convention): TimeScrubber's on-screen atMs
// updates immediately; only the URL/history write settles after a short
// pause in dragging.
const URL_WRITE_DEBOUNCE_MS = 300;

const GROUND_OPTIONS: SegmentedControlOption<GroundType>[] = [
  { value: 'land', label: 'Land' },
  { value: 'sea', label: 'Sea' },
  { value: 'mixed', label: 'Mixed' },
];

/**
 * `atMs`/`liveNow`/`onScrub`/`onGoLive` — the `useConditions()` clock,
 * lifted OUT of this component in phase 10 (F7.1) and instantiated once
 * in `App.tsx`'s `Shell`, shared with `TransportControl` (see
 * `viewerState.tsx`'s phase-10 CORRECTION note for why: the transport
 * control is a second writer of `atMs`, and it lives in the shared
 * chrome, not inside this component). `onScrub` here wraps the raw
 * clock's `scrubTo` with "pause playback first" (F7.1's own "yields to
 * interaction" AC) — this component's own manual `TimeScrubber` drag
 * counts as interaction the same way the transport control's own scrub
 * slider does.
 *
 * `resetToken` — Slice 2's (F7.2) global reset. A plain `key`-based
 * remount was tried first and rejected: `App.tsx`'s `handleReset` also
 * clears the URL via `useViewerUrlState`'s `setState`, but React Router's
 * data router applies that navigation asynchronously, so a remount
 * scheduled in the SAME synchronous batch reliably raced ahead of the
 * URL actually clearing and re-seeded this component's local state from
 * the STALE (pre-reset) query string. Resetting local state directly, in
 * an effect keyed on `resetToken`, sidesteps the URL entirely for this
 * component's own fields (`ground`/driver/`bandId`/`frequencyMhz`) —
 * the URL still gets cleared for other fields, just not depended on here.
 */
export interface ConditionsBarProps {
  atMs: number;
  liveNow: boolean;
  onScrub: (atMs: number) => void;
  onGoLive: () => void;
  /** Bumped by `App.tsx`'s reset button; any change (not the first render) resets ground/driver/band/frequency to their defaults. */
  resetToken?: number;
}

export default function ConditionsBar({
  atMs,
  liveNow,
  onScrub,
  onGoLive,
  resetToken,
}: ConditionsBarProps) {
  const { state: urlState, setState: setUrlState } = useViewerUrlState();
  const { state: viewerState, setState: setViewerState } = useViewerState();

  // Seeded once from the URL at first mount (a shared permalink's
  // Conditions override is respected on first paint) — not continuously
  // re-synced from the URL afterwards, same "own the runtime state, URL
  // is a permalink door in/out" pattern `StationBar.tsx` already
  // established for Station via localStorage instead.
  const [initial] = useState(() => urlState.conditions);

  const scrubTo = (nextAtMs: number) => {
    if (viewerState.playback.playing) {
      setViewerState((prev) => ({ ...prev, playback: { ...prev.playback, playing: false } }));
    }
    onScrub(nextAtMs);
  };
  const goLive = () => {
    if (viewerState.playback.playing) {
      setViewerState((prev) => ({ ...prev, playback: { ...prev.playback, playing: false } }));
    }
    onGoLive();
  };
  const [ground, setGround] = useState<GroundType>(initial.gnd ?? DEFAULT_CONDITIONS.ground);
  const [initialManual] = useState(() =>
    initial.dk === 'manual' && initial.sfi !== undefined && initial.kp !== undefined
      ? { sfi: initial.sfi, kp: initial.kp }
      : null,
  );
  const { driver, setManualDriver, clearManualDriver, isManual } =
    useConditionsDriver(initialManual);
  const [editing, setEditing] = useState(false);

  const [bandId, setBandId] = useState(urlState.bandId);
  const selectedBand = UK_AMATEUR_BANDS.find((band) => band.id === bandId) ?? UK_AMATEUR_BANDS[0];
  const [frequencyMhz, setFrequencyMhz] = useState(() => bandMidpointMhz(bandId));

  // Global reset (F7.2) -- skips the very first render (a `resetToken`
  // change is only meaningful after mount; `undefined -> 0` on first
  // paint must not immediately "reset" a component that was never
  // touched). See this component's own doc comment above for why this
  // resets local state directly rather than via a `key`-based remount.
  const lastResetTokenRef = useRef(resetToken);
  useEffect(() => {
    if (resetToken === undefined || resetToken === lastResetTokenRef.current) return;
    lastResetTokenRef.current = resetToken;
    setGround(DEFAULT_CONDITIONS.ground);
    clearManualDriver();
    setEditing(false);
    setBandId(DEFAULT_BAND_ID);
    setFrequencyMhz(bandMidpointMhz(DEFAULT_BAND_ID));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  function selectBand(nextBandId: string) {
    setBandId(nextBandId);
    setFrequencyMhz(bandMidpointMhz(nextBandId));
  }

  // Realism unlock (F7.3, phase 10's Slice 3). Off by default (F7.3's
  // own AC) -- `DEFAULT_PLAYBACK.unrealismUnlocked` is already `false`.
  //
  // Toggling OFF clamps any currently out-of-range frequency/manual-driver
  // value back into the locked bound (this phase's own "clamp, don't just
  // re-hide" call) -- done directly in this handler (the toggle's own
  // `onChange`), not in a `useEffect` keyed on the transition: the effect
  // form was tried first and rejected by this repo's stricter
  // react-hooks/refs-style lint rule ("calling setState synchronously
  // within an effect can trigger cascading renders") -- the clamp only
  // ever needs to run in direct response to this one user action anyway,
  // so a plain conditional in the handler is both the simpler code and
  // the one the lint rule actually wants.
  const unlocked = viewerState.playback.unrealismUnlocked;
  function setUnlocked(next: boolean) {
    if (!next) {
      const clampedFrequency = clamp(frequencyMhz, frequencyRange(false, selectedBand));
      if (clampedFrequency !== frequencyMhz) setFrequencyMhz(clampedFrequency);
      if (isManual) {
        const clampedSfi = clamp(driver.sfi, sfiRange(false));
        const clampedKp = clamp(driver.kp, kpRange(false));
        if (clampedSfi !== driver.sfi || clampedKp !== driver.kp) {
          setManualDriver(clampedSfi, clampedKp);
        }
      }
    }
    setViewerState((prev) => ({
      ...prev,
      playback: { ...prev.playback, unrealismUnlocked: next },
    }));
  }

  const [debouncedAtMs] = useDebouncedValue(atMs, URL_WRITE_DEBOUNCE_MS);

  useEffect(() => {
    const nextConditions: ConditionsUrlState = {
      t: liveNow ? undefined : debouncedAtMs,
      // A live snapshot isn't meaningful to encode in a shareable link —
      // see ConditionsUrlState's own doc comment in urlState/types.ts.
      dk: driver.kind === 'live' ? undefined : driver.kind,
      sfi: driver.kind === 'live' ? undefined : driver.sfi,
      kp: driver.kind === 'live' ? undefined : driver.kp,
      gnd: ground,
    };
    setUrlState({ ...urlState, conditions: nextConditions, bandId });
    // `urlState` deliberately excluded: this effect only needs to react
    // to Conditions'/band's own fields changing, not to re-fire whenever
    // the decoded URL state object gets a new identity (e.g. from this
    // same write) — `surface`/`station` are read fresh from the latest
    // render's `urlState` when this does run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAtMs, liveNow, driver.kind, driver.sfi, driver.kp, ground, bandId]);

  // Publishes the live (non-debounced) Conditions/band/frequency into
  // ViewerState (phase 8, Reach — see viewerState.tsx's own doc comment)
  // so surfaces outside this bar (Reach's coverage grid, later Path/
  // Timeline/Explore) can read the operator's current Conditions without
  // reaching into this component's local hooks. Deliberately UNDEBOUNCED
  // and separate from the URL-write effect above: "debouncing applies to
  // persistence, never to rendering" (phase 8's own Slice 1 note) — a drag
  // or scrub must animate the coverage surface immediately, the permalink
  // query string is the only thing allowed to lag. Depends on `driver`'s
  // primitive fields (not the `driver` object itself, which
  // `useConditionsDriver` reconstructs fresh every render) for the same
  // reason the URL-write effect above does.
  useEffect(() => {
    const conditions: Conditions = {
      atMs,
      liveNow,
      driver,
      ground,
    };
    setViewerState((prev) => ({ ...prev, conditions, bandId, frequencyMhz }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    atMs,
    liveNow,
    driver.kind,
    driver.sfi,
    driver.kp,
    driver.fetchedAtMs,
    ground,
    bandId,
    frequencyMhz,
    setViewerState,
  ]);

  const provenance = describeDriverProvenance(driver);

  return (
    <div className={classes.root} data-testid="conditions-bar">
      <div className={classes.compactRow}>
        <span className={classes.summary} title={provenance}>
          {selectedBand.label} @ {frequencyMhz} MHz · SFI {driver.sfi} · Kp {driver.kp} ·{' '}
          <span className={classes.provenance}>{provenance}</span>
        </span>
        <Button
          className={classes.editToggle}
          variant={editing ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setEditing((visible) => !visible)}
        >
          {editing ? 'Done' : 'Edit conditions'}
        </Button>
      </div>

      {editing ? (
        <div className={classes.expanded}>
          <ToggleSwitch
            checked={unlocked}
            onChange={setUnlocked}
            label="Unrealistic values (sandbox mode)"
            aria-label="Realism unlock"
          />

          <div className={classes.bandSection}>
            <BandChips bandId={bandId} onChange={selectBand} />
            <FrequencyField
              band={selectedBand}
              frequencyMhz={frequencyMhz}
              onChange={setFrequencyMhz}
              unlocked={unlocked}
            />
          </div>

          <TimeScrubber atMs={atMs} liveNow={liveNow} onScrub={scrubTo} onGoLive={goLive} />

          <div className={classes.driverSection}>
            <ManualDriverFields
              sfi={driver.sfi}
              kp={driver.kp}
              onCommit={(sfi, kp) => setManualDriver(sfi, kp)}
              unlocked={unlocked}
            />
            {isManual ? (
              <Button variant="ghost" size="sm" onClick={clearManualDriver}>
                Use live/last-known
              </Button>
            ) : null}
          </div>

          <SegmentedControl
            aria-label="Ground type"
            options={GROUND_OPTIONS}
            value={ground}
            onChange={setGround}
          />
        </div>
      ) : null}
    </div>
  );
}
