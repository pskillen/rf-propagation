// TX power input, feeding EIRP — the field exists and is the right shape
// for phase 3's eirpDbm = 10*log10(txPowerW*1000) + txAntennaGainDbi
// formula to consume later (phase 8); this phase does not call it.
//
// Judgment call, flagged: commits on blur/Enter rather than per-keystroke,
// so mergeStation (and its localStorage write) doesn't run on every digit
// typed. This is a lighter-weight version of the debounced-inputs skill's
// committed+commit pattern (useDebouncedOptionalNumberField) rather than a
// full port of that hook — the skill itself says to port it "the first
// time a persisted input needs this behaviour"; this phase's inputs are
// simple enough (no drag/slider, no expensive recompute triggered) that a
// local draft + blur-commit covers the same "don't write every keystroke"
// concern without the extra hook machinery.
import { useState } from 'react';
import type { Station } from '@core/domain/station/types';
import { mergeStation } from '@integrations/station/persistence';
import { FormField, TextInput } from '../v2/index.ts';
import classes from './PowerInput.module.css';

export interface PowerInputProps {
  powerW: number;
  onStationChange: (station: Station) => void;
}

export default function PowerInput({ powerW, onStationChange }: PowerInputProps) {
  const [draft, setDraft] = useState(String(powerW));
  const [editing, setEditing] = useState(false);
  // Adjusting state during render (React's documented pattern for
  // "resetting state when a prop changes") rather than an effect — an
  // effect here would setState synchronously on every external powerW
  // change and trigger a cascading extra render.
  const [lastSyncedPowerW, setLastSyncedPowerW] = useState(powerW);
  if (powerW !== lastSyncedPowerW && !editing) {
    setLastSyncedPowerW(powerW);
    setDraft(String(powerW));
  }

  function commit() {
    setEditing(false);
    const parsed = Number(draft);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDraft(String(powerW));
      return;
    }
    if (parsed === powerW) return;
    onStationChange(mergeStation({ powerW: parsed }));
  }

  return (
    <div className={classes.root}>
      <FormField label="TX power (W)">
        <TextInput
          variant="plain"
          type="number"
          min={0}
          aria-label="TX power (W)"
          value={draft}
          onFocus={() => setEditing(true)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
      </FormField>
    </div>
  );
}
