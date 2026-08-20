// Frequency-within-band (F4.8) — a numeric field clamped to
// [band.minMhz, band.maxMhz], same "local draft + commit on blur/Enter"
// pattern as Station's PowerInput. Not persisted to the URL (only
// `bandId` is — see `fields/band.ts`); this is ephemeral, resets to the
// new band's midpoint whenever `band` changes (owned by the parent,
// `ConditionsBar`).
//
// `unlocked` (F7.3, phase 10's Slice 3) — while true, the commit clamp
// relaxes to `UNLOCKED_FREQUENCY_RANGE_MHZ` (1-30 MHz, ignoring the
// band's own edges entirely) instead of `[band.minMhz, band.maxMhz]`.
// The field is marked (a destructive-styled border + hint, via
// `FormField`'s own `error` prop) whenever the CURRENT value sits
// outside the REALISTIC bound, regardless of whether the toggle is
// currently on — turning the toggle back off doesn't silently hide that
// the value is unrealistic; see `ConditionsBar.tsx`'s own clamp-on-lock
// effect for what happens to the value itself at that moment.
import { useState } from 'react';
import type { BandDefinition } from '@core/domain/bandCatalog';
import { frequencyRange, isFrequencyOutOfRealisticBounds } from '../../lib/realismBounds.ts';
import { FormField, TextInput } from '../v2/index.ts';

export interface FrequencyFieldProps {
  band: BandDefinition;
  frequencyMhz: number;
  onChange: (frequencyMhz: number) => void;
  unlocked?: boolean;
}

export default function FrequencyField({
  band,
  frequencyMhz,
  onChange,
  unlocked = false,
}: FrequencyFieldProps) {
  const [draft, setDraft] = useState(String(frequencyMhz));
  const [editing, setEditing] = useState(false);
  const [lastSynced, setLastSynced] = useState(frequencyMhz);

  if (frequencyMhz !== lastSynced && !editing) {
    setLastSynced(frequencyMhz);
    setDraft(String(frequencyMhz));
  }

  const range = frequencyRange(unlocked, band);
  const outOfBounds = isFrequencyOutOfRealisticBounds(frequencyMhz, band);

  function commit() {
    setEditing(false);
    const parsed = Number(draft);
    const clamped = Number.isFinite(parsed)
      ? Math.min(range.max, Math.max(range.min, parsed))
      : frequencyMhz;
    setDraft(String(clamped));
    if (clamped === frequencyMhz) return;
    onChange(clamped);
  }

  return (
    <FormField
      label={`Frequency (MHz, ${range.min}–${range.max})`}
      error={outOfBounds ? 'Outside the realistic range for this band' : undefined}
    >
      <TextInput
        variant="plain"
        type="number"
        min={range.min}
        max={range.max}
        step={0.001}
        aria-label="Frequency (MHz)"
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
    </FormField>
  );
}
