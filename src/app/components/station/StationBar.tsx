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
import { useCallback, useState } from 'react';
import type { Station } from '@core/domain/station/types';
import { useViewerState } from '../../state/viewerState.tsx';
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
  const setStation = useCallback(
    (next: Station) => setState((prev) => ({ ...prev, station: next })),
    [setState],
  );
  const [editing, setEditing] = useState(false);

  const activeAntenna =
    station.antennas.find((antenna) => antenna.id === station.activeAntennaId) ??
    station.antennas[0];

  const summary = `${station.qth.locator} · ${activeAntenna.name} @ ${activeAntenna.heightM} m · ${station.powerW} W`;

  return (
    <div className={classes.root} data-testid="station-bar">
      <div className={classes.compactRow}>
        <p className={classes.summary} title={summary}>
          {summary}
        </p>
        <div className={classes.powerField}>
          <PowerInput powerW={station.powerW} onStationChange={setStation} />
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
              />
              <AntennaPatternPreview antenna={activeAntenna} />
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
