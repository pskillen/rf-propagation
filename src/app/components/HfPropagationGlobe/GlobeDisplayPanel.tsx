/**
 * Globe Display panel (F6.2, phase 9's Slice 2) — exposes
 * `ShellDisplayOptions`'s four controls (altitude exaggeration, exploded
 * stacking, Fresnel shading, cutaway plane) plus the day/night terminator
 * toggle, against `ViewerState.display.globeToggles` (a single
 * `value`/`onChange(next)` pair, not per-field callbacks — the caller
 * owns the actual `setState` write, same pattern `TargetPanel`/`StationBar`
 * already use for other `ViewerState` sub-objects).
 *
 * **Standing constraint (FR-27/FR-28, same as phase 8):** every control
 * here responds continuously while dragging — the exaggeration `Slider`
 * uses Mantine's own `onChange` (fires on every drag-move tick), not
 * `onChangeEnd`. This is not something this phase adds; it is preserved
 * from the reference component's own already-correct behaviour.
 */
import { Input, Slider, Stack } from '@mantine/core';
import type { GlobeToggles } from '../../state/globeToggles.ts';
import { MAX_EXAGGERATION_FACTOR, MIN_EXAGGERATION_FACTOR } from '../../state/globeToggles.ts';
import { Panel, ToggleSwitch } from '../v2/index.ts';

export interface GlobeDisplayPanelProps {
  value: GlobeToggles;
  onChange: (next: GlobeToggles) => void;
}

export default function GlobeDisplayPanel({ value, onChange }: GlobeDisplayPanelProps) {
  return (
    <Panel title="Display" sub="How the 3D globe draws layers — not a change to the physics.">
      <Stack gap="lg">
        <Input.Wrapper label={`Altitude exaggeration — ${value.exaggerationFactor.toFixed(1)}×`}>
          <Slider
            aria-label="Altitude exaggeration"
            thumbLabel="Altitude exaggeration"
            value={value.exaggerationFactor}
            onChange={(exaggerationFactor) => onChange({ ...value, exaggerationFactor })}
            min={MIN_EXAGGERATION_FACTOR}
            max={MAX_EXAGGERATION_FACTOR}
            step={0.5}
            mb={16}
          />
        </Input.Wrapper>
        <ToggleSwitch
          checked={value.explodeEnabled}
          onChange={(explodeEnabled) => onChange({ ...value, explodeEnabled })}
          label="Exploded layer stacking"
        />
        <ToggleSwitch
          checked={value.fresnelEnabled}
          onChange={(fresnelEnabled) => onChange({ ...value, fresnelEnabled })}
          label="Fresnel shading"
        />
        <ToggleSwitch
          checked={value.terminatorEnabled}
          onChange={(terminatorEnabled) => onChange({ ...value, terminatorEnabled })}
          label="Day/night terminator"
        />
        <ToggleSwitch
          checked={value.cutawayEnabled}
          onChange={(cutawayEnabled) => onChange({ ...value, cutawayEnabled })}
          label="Cutaway plane"
        />
      </Stack>
    </Panel>
  );
}
