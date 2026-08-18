// Fills AppChrome's stationBar slot (phase 5's contract). Always renders a
// populated Station — never a wizard, empty state, or modal (F4.5): a
// first-time visitor with no saved Station boots straight to
// DEFAULT_STATION. The QTH picker and antenna switcher/editor sit behind a
// compact "Edit" affordance (collapsing to a summary line, per
// ux-and-ia.md §3's own mobile example); TX power stays visible and
// functional in the compact row itself, so "something meaningful can be
// changed within one interaction of arriving" doesn't depend on the user
// finding the edit toggle first.
//
// Station now lives in `ViewerState` (phase 8, Reach — see
// viewerState.tsx's own doc comment for why), not local `useState`: Reach's
// live-draggable station marker commits a new QTH via the same shared
// state, and StationBar must reflect that without a stale local copy.
// `station`/`setStation` below are just a thin view over the shared
// context; every mutation still funnels through `mergeStation` for
// persistence exactly as before.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AntennaConfig, Station } from '@core/domain/station/types';
import { mergeStation } from '@integrations/station/persistence';
import { useViewerState } from '../../state/viewerState.tsx';
import { antennaHeightRange, clamp, txPowerRange } from '../../lib/realismBounds.ts';
import { Button, Panel } from '../v2/index.ts';
import AntennaList from './AntennaList.tsx';
import AntennaPatternPreview from './AntennaPatternPreview.tsx';
import NoiseEnvironmentControl from './NoiseEnvironmentControl.tsx';
import PowerInput from './PowerInput.tsx';
import QthPicker from './QthPicker.tsx';
import classes from './StationBar.module.css';

export default function StationBar() {
  const { state, setState } = useViewerState();
  const station = state.station;
  const unlocked = state.playback.unrealismUnlocked;
  const setStation = useCallback(
    (next: Station) => setState((prev) => ({ ...prev, station: next })),
    [setState],
  );
  const [editing, setEditing] = useState(false);
  // Slice 3 (fix/reach-directionality-antenna-greyline): AntennaList's own
  // in-progress add/edit form draft, published up via its onDraftChange --
  // component-local, not ViewerState (nothing outside this bar needs it).
  const [draftAntenna, setDraftAntenna] = useState<AntennaConfig | null>(null);

  const activeAntenna =
    station.antennas.find((antenna) => antenna.id === station.activeAntennaId) ??
    station.antennas[0];

  // Realism unlock (F7.3, phase 10's Slice 3): toggling OFF clamps any
  // currently out-of-range value back into the locked bound, rather than
  // merely hiding that it's out of range (this phase's own "clamp, don't
  // just re-hide" call, documented in the plan file's Slice 3). Only
  // fires on a true -> false transition, not on every render.
  const wasUnlockedRef = useRef(unlocked);
  useEffect(() => {
    if (wasUnlockedRef.current && !unlocked) {
      const clampedPowerW = clamp(station.powerW, txPowerRange(false));
      const clampedHeightM = clamp(activeAntenna.heightM, antennaHeightRange(false));
      if (clampedPowerW !== station.powerW || clampedHeightM !== activeAntenna.heightM) {
        setStation(
          mergeStation({
            powerW: clampedPowerW,
            antennas: station.antennas.map((antenna) =>
              antenna.id === activeAntenna.id ? { ...antenna, heightM: clampedHeightM } : antenna,
            ),
          }),
        );
      }
    }
    wasUnlockedRef.current = unlocked;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  const summary = `${station.qth.locator} · ${activeAntenna.name} @ ${activeAntenna.heightM} m · ${station.powerW} W`;

  return (
    <div className={classes.root} data-testid="station-bar">
      <div className={classes.compactRow}>
        <p className={classes.summary} title={summary}>
          {summary}
        </p>
        <div className={classes.powerField}>
          <PowerInput powerW={station.powerW} onStationChange={setStation} unlocked={unlocked} />
        </div>
        <Button
          className={classes.editToggle}
          variant={editing ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setEditing((visible) => !visible)}
        >
          {editing ? 'Done' : 'Edit station'}
        </Button>
      </div>

      {editing ? (
        <div className={classes.expanded}>
          <Panel title="QTH">
            <QthPicker qth={station.qth} onStationChange={setStation} />
          </Panel>
          <Panel title="Antennas">
            <div className={classes.antennaSection}>
              <AntennaList
                antennas={station.antennas}
                activeAntennaId={station.activeAntennaId}
                onStationChange={setStation}
                onDraftChange={setDraftAntenna}
                unlocked={unlocked}
              />
              {/* Slice 3: shows the in-progress add/edit draft while the
                  form is open, falling back to the active antenna
                  otherwise -- previously always activeAntenna, which was
                  wrong while a form was open (the gap this slice fixes). */}
              <AntennaPatternPreview antenna={draftAntenna ?? activeAntenna} />
            </div>
          </Panel>
          <Panel title="Noise environment">
            <div className={classes.noiseSection}>
              <span className={classes.noiseLabel}>Feeds the receive noise floor (F2.7).</span>
              <NoiseEnvironmentControl
                noiseEnvironment={station.noiseEnvironment}
                onStationChange={setStation}
              />
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
