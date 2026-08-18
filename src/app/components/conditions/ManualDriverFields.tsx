// Manual SFI/Kp entry (F4.7's third fallback tier) — same "local draft +
// commit on blur/Enter" pattern as Station's PowerInput
// (`../station/PowerInput.tsx`): don't call onCommit on every keystroke.
import { useState } from 'react';
import { FormField, TextInput } from '../v2/index.ts';
import classes from './ManualDriverFields.module.css';

export interface ManualDriverFieldsProps {
  sfi: number;
  kp: number;
  onCommit: (sfi: number, kp: number) => void;
}

export default function ManualDriverFields({ sfi, kp, onCommit }: ManualDriverFieldsProps) {
  const [sfiDraft, setSfiDraft] = useState(String(sfi));
  const [kpDraft, setKpDraft] = useState(String(kp));
  const [editing, setEditing] = useState(false);
  const [lastSynced, setLastSynced] = useState({ sfi, kp });

  if ((sfi !== lastSynced.sfi || kp !== lastSynced.kp) && !editing) {
    setLastSynced({ sfi, kp });
    setSfiDraft(String(sfi));
    setKpDraft(String(kp));
  }

  function commit() {
    setEditing(false);
    const parsedSfi = Number(sfiDraft);
    const parsedKp = Number(kpDraft);
    const validSfi = Number.isFinite(parsedSfi) && parsedSfi > 0 ? parsedSfi : sfi;
    const validKp = Number.isFinite(parsedKp) && parsedKp >= 0 && parsedKp <= 9 ? parsedKp : kp;
    setSfiDraft(String(validSfi));
    setKpDraft(String(validKp));
    if (validSfi === sfi && validKp === kp) return;
    onCommit(validSfi, validKp);
  }

  return (
    <div className={classes.root}>
      <FormField label="SFI">
        <TextInput
          variant="plain"
          type="number"
          min={0}
          aria-label="Solar Flux Index"
          value={sfiDraft}
          onFocus={() => setEditing(true)}
          onChange={(event) => setSfiDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
      </FormField>
      <FormField label="Kp">
        <TextInput
          variant="plain"
          type="number"
          min={0}
          max={9}
          aria-label="Kp index"
          value={kpDraft}
          onFocus={() => setEditing(true)}
          onChange={(event) => setKpDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
      </FormField>
    </div>
  );
}
