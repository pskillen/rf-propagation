// Fills AppChrome's conditionsBar slot (phase 5's contract). Composes
// Slice 1's time model (`useConditions`/`TimeScrubber`) and Slice 2's
// fallback-chain driver (`useConditionsDriver`) into one compact/expanded
// bar, mirroring Station's `StationBar.tsx` layout convention. Always
// shows provenance next to the SFI/Kp values (F4.7,
// ux-and-ia.md §8 "Solar inputs show provenance inline") — never just on
// the live path.
import { useEffect, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import type { GroundType } from '@core/domain/propagation/losses';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import { conditionsUrlStateToInitialTime } from '../../lib/urlState/fields/conditions.ts';
import type { ConditionsUrlState } from '../../lib/urlState/types.ts';
import { useConditions } from '../../hooks/useConditions.ts';
import { describeDriverProvenance, useConditionsDriver } from '../../hooks/useConditionsDriver.ts';
import { useViewerUrlState } from '../../hooks/useViewerUrlState.ts';
import { Button, SegmentedControl, type SegmentedControlOption } from '../v2/index.ts';
import BandChips from './BandChips.tsx';
import FrequencyField from './FrequencyField.tsx';
import ManualDriverFields from './ManualDriverFields.tsx';
import TimeScrubber from './TimeScrubber.tsx';
import classes from './ConditionsBar.module.css';

function bandMidpointMhz(bandId: string): number {
  const band = UK_AMATEUR_BANDS.find((b) => b.id === bandId) ?? UK_AMATEUR_BANDS[0];
  return Math.round(((band.minMhz + band.maxMhz) / 2) * 1000) / 1000;
}

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

export default function ConditionsBar() {
  const { state: urlState, setState: setUrlState } = useViewerUrlState();

  // Seeded once from the URL at first mount (a shared permalink's
  // Conditions override is respected on first paint) — not continuously
  // re-synced from the URL afterwards, same "own the runtime state, URL
  // is a permalink door in/out" pattern `StationBar.tsx` already
  // established for Station via localStorage instead.
  const [initial] = useState(() => urlState.conditions);

  const { atMs, liveNow, scrubTo, goLive } = useConditions(
    conditionsUrlStateToInitialTime(initial),
  );
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

  function selectBand(nextBandId: string) {
    setBandId(nextBandId);
    setFrequencyMhz(bandMidpointMhz(nextBandId));
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
          <div className={classes.bandSection}>
            <BandChips bandId={bandId} onChange={selectBand} />
            <FrequencyField
              band={selectedBand}
              frequencyMhz={frequencyMhz}
              onChange={setFrequencyMhz}
            />
          </div>

          <TimeScrubber atMs={atMs} liveNow={liveNow} onScrub={scrubTo} onGoLive={goLive} />

          <div className={classes.driverSection}>
            <ManualDriverFields
              sfi={driver.sfi}
              kp={driver.kp}
              onCommit={(sfi, kp) => setManualDriver(sfi, kp)}
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
