// Frequency-within-band (F4.8) — a numeric field clamped to
// [band.minMhz, band.maxMhz], same "local draft + commit on blur/Enter"
// pattern as Station's PowerInput. Not persisted to the URL (only
// `bandId` is — see `fields/band.ts`); this is ephemeral, resets to the
// new band's midpoint whenever `band` changes (owned by the parent,
// `ConditionsBar`).
import { useState } from 'react';
import type { BandDefinition } from '@core/domain/bandCatalog';
import { FormField, TextInput } from '../v2/index.ts';

export interface FrequencyFieldProps {
  band: BandDefinition;
  frequencyMhz: number;
  onChange: (frequencyMhz: number) => void;
}

export default function FrequencyField({ band, frequencyMhz, onChange }: FrequencyFieldProps) {
  const [draft, setDraft] = useState(String(frequencyMhz));
  const [editing, setEditing] = useState(false);
  const [lastSynced, setLastSynced] = useState(frequencyMhz);

  if (frequencyMhz !== lastSynced && !editing) {
    setLastSynced(frequencyMhz);
    setDraft(String(frequencyMhz));
  }

  function commit() {
    setEditing(false);
    const parsed = Number(draft);
    const clamped = Number.isFinite(parsed)
      ? Math.min(band.maxMhz, Math.max(band.minMhz, parsed))
      : frequencyMhz;
    setDraft(String(clamped));
    if (clamped === frequencyMhz) return;
    onChange(clamped);
  }

  return (
    <FormField label={`Frequency (MHz, ${band.minMhz}–${band.maxMhz})`}>
      <TextInput
        variant="plain"
        type="number"
        min={band.minMhz}
        max={band.maxMhz}
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
