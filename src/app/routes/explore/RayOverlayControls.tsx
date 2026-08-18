/**
 * Explore's ray overlay operator controls (F8.2, [#65]) — radial count,
 * elevations-per-radial, elevation spread, and a manual bearing (only
 * meaningful when no target is set — otherwise the fan already points at
 * the target).
 *
 * [#65]: https://github.com/pskillen/rf-propagation/issues/65
 */
import { Panel, TextInput } from '../../components/v2/index.ts';
import {
  RAY_ELEVATIONS_MAX,
  RAY_ELEVATIONS_MIN,
  RAY_RADIALS_MAX,
  RAY_RADIALS_MIN,
  type RayControlsState,
} from '../../state/rayControls.ts';
import classes from './RayOverlayControls.module.css';

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
    </Panel>
  );
}
