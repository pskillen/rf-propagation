// Noise environment selector — the four literal values from phase 3's own
// NoiseEnvironment type (imported, not hardcoded as a parallel string
// list), feeding F2.7's noiseFloorDbm once phase 8 wires the engine call.
import type { NoiseEnvironment } from '@core/domain/propagation/noise';
import type { Station } from '@core/domain/station/types';
import { mergeStation } from '@integrations/station/persistence';
import { SegmentedControl, type SegmentedControlOption } from '../v2/index.ts';

export interface NoiseEnvironmentControlProps {
  noiseEnvironment: NoiseEnvironment;
  onStationChange: (station: Station) => void;
}

const NOISE_ENVIRONMENT_LABELS: Record<NoiseEnvironment, string> = {
  quietRural: 'Quiet rural',
  rural: 'Rural',
  residential: 'Residential',
  urban: 'Urban',
};

const NOISE_ENVIRONMENT_OPTIONS: SegmentedControlOption<NoiseEnvironment>[] = (
  Object.keys(NOISE_ENVIRONMENT_LABELS) as NoiseEnvironment[]
).map((value) => ({ value, label: NOISE_ENVIRONMENT_LABELS[value] }));

export default function NoiseEnvironmentControl({
  noiseEnvironment,
  onStationChange,
}: NoiseEnvironmentControlProps) {
  return (
    <SegmentedControl
      aria-label="Noise environment"
      options={NOISE_ENVIRONMENT_OPTIONS}
      value={noiseEnvironment}
      onChange={(value) => onStationChange(mergeStation({ noiseEnvironment: value }))}
    />
  );
}
