/**
 * Explore's ray overlay operator controls (F8.2, [#65]; extended by Slice
 * 3, F8.3, [#68], with outcome filtering / colour-by / layer soloing) —
 * radial count, elevations-per-radial, elevation spread, a manual bearing
 * (only meaningful when no target is set — otherwise the fan already
 * points at the target), the outcome filter, colour-by mode, and a
 * layer-solo picker.
 *
 * [#65]: https://github.com/pskillen/rf-propagation/issues/65
 * [#68]: https://github.com/pskillen/rf-propagation/issues/68
 */
import type { LayerId } from '@core/domain/propagation/layers';
import { LAYER_IDS_INNER_TO_OUTER } from '@core/domain/propagation/layerColor';
import {
  Panel,
  SegmentedControl,
  TextInput,
  type SegmentedControlOption,
} from '../../components/v2/index.ts';
import TermDefinition from '../../components/TermDefinition/TermDefinition.tsx';
import {
  RAY_ELEVATIONS_MAX,
  RAY_ELEVATIONS_MIN,
  RAY_RADIALS_MAX,
  RAY_RADIALS_MIN,
  type RayControlsState,
} from '../../state/rayControls.ts';
import classes from './RayOverlayControls.module.css';

/** Segmented-control has no "no selection" value of its own — an empty string stands for "no layer soloed." */
const NO_SOLO = '';

const OUTCOME_OPTIONS: SegmentedControlOption<RayControlsState['outcomeFilter']>[] = [
  { value: 'all', label: 'All' },
  { value: 'escaped', label: 'Escaped' },
  { value: 'returned', label: 'Returned' },
  { value: 'absorbed', label: 'Absorbed' },
];

const COLOUR_BY_OPTIONS: SegmentedControlOption<RayControlsState['colourBy']>[] = [
  { value: 'mode', label: 'Outcome' },
  { value: 'layer', label: 'Layer' },
  { value: 'signalStrength', label: 'Signal' },
];

const SOLO_OPTIONS: SegmentedControlOption<LayerId | typeof NO_SOLO>[] = [
  { value: NO_SOLO, label: 'None' },
  ...LAYER_IDS_INNER_TO_OUTER.map((id) => ({ value: id, label: id })),
];

export interface RayOverlayControlsProps {
  value: RayControlsState;
  onChange: (next: RayControlsState) => void;
  /** Disables the manual-bearing input — a target sets the bearing instead. */
  bearingLocked: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function RayOverlayControls({
  value,
  onChange,
  bearingLocked,
}: RayOverlayControlsProps) {
  return (
    <Panel title="Ray overlay">
      <div className={classes.grid}>
        <TextInput
          label="Radials"
          type="number"
          min={RAY_RADIALS_MIN}
          max={RAY_RADIALS_MAX}
          value={value.radials}
          onChange={(e) =>
            onChange({
              ...value,
              radials: clamp(
                Number(e.target.value) || RAY_RADIALS_MIN,
                RAY_RADIALS_MIN,
                RAY_RADIALS_MAX,
              ),
            })
          }
        />
        <TextInput
          label="Elevations per radial"
          type="number"
          min={RAY_ELEVATIONS_MIN}
          max={RAY_ELEVATIONS_MAX}
          value={value.elevations}
          onChange={(e) =>
            onChange({
              ...value,
              elevations: clamp(
                Number(e.target.value) || RAY_ELEVATIONS_MIN,
                RAY_ELEVATIONS_MIN,
                RAY_ELEVATIONS_MAX,
              ),
            })
          }
        />
        <TextInput
          label="Min elevation °"
          type="number"
          min={0}
          max={89}
          value={value.elevationSpreadDeg[0]}
          onChange={(e) =>
            onChange({
              ...value,
              elevationSpreadDeg: [
                clamp(Number(e.target.value) || 0, 0, value.elevationSpreadDeg[1]),
                value.elevationSpreadDeg[1],
              ],
            })
          }
        />
        <TextInput
          label="Max elevation °"
          type="number"
          min={0}
          max={89}
          value={value.elevationSpreadDeg[1]}
          onChange={(e) =>
            onChange({
              ...value,
              elevationSpreadDeg: [
                value.elevationSpreadDeg[0],
                clamp(Number(e.target.value) || 89, value.elevationSpreadDeg[0], 89),
              ],
            })
          }
        />
        <TextInput
          label="Bearing °"
          type="number"
          min={0}
          max={359}
          disabled={bearingLocked}
          hint={bearingLocked ? 'Following the current target' : undefined}
          value={Math.round(value.focusBearingDeg)}
          onChange={(e) => onChange({ ...value, focusBearingDeg: Number(e.target.value) || 0 })}
        />
      </div>

      <div className={classes.section}>
        <span className={classes.sectionLabel}>Filter by outcome</span>
        <SegmentedControl
          options={OUTCOME_OPTIONS}
          value={value.outcomeFilter}
          onChange={(outcomeFilter) => onChange({ ...value, outcomeFilter })}
          aria-label="Filter rays by outcome"
        />
      </div>

      <div className={classes.section}>
        <span className={classes.sectionLabel}>Colour by</span>
        <SegmentedControl
          options={COLOUR_BY_OPTIONS}
          value={value.colourBy}
          onChange={(colourBy) => onChange({ ...value, colourBy })}
          aria-label="Colour rays by"
        />
        {value.colourBy === 'signalStrength' ? (
          <p className={classes.hint}>
            Weak-to-strong is driven by each ray&apos;s{' '}
            <TermDefinition term="snrMargin">SNR margin</TermDefinition>.
          </p>
        ) : null}
      </div>

      <div className={classes.section}>
        <span className={classes.sectionLabel}>Solo a layer</span>
        <SegmentedControl
          options={SOLO_OPTIONS}
          value={value.soloLayerId ?? NO_SOLO}
          onChange={(soloLayerId) =>
            onChange({ ...value, soloLayerId: soloLayerId === NO_SOLO ? undefined : soloLayerId })
          }
          aria-label="Solo a layer"
        />
      </div>
    </Panel>
  );
}
