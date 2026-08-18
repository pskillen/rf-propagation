// Manual SFI/Kp entry (F4.7's third fallback tier) — same "local draft +
// commit on blur/Enter" pattern as Station's PowerInput
// (`../station/PowerInput.tsx`): don't call onCommit on every keystroke.
//
// `unlocked` (F7.3, phase 10's Slice 3) — while true, SFI's commit clamp
// relaxes to `UNLOCKED_SFI_RANGE` (0-500) instead of the realistic
// 60-300 range; Kp's own range is already the real 0-9 scale, so
// unlocking it has no numeric effect (kept symmetrical rather than
// special-cased). Either field is marked out-of-bounds (a
// destructive-styled border + hint) whenever its CURRENT value sits
// outside the REALISTIC range, regardless of the toggle.
import { useState } from 'react';
import {
  isKpOutOfRealisticBounds,
  isSfiOutOfRealisticBounds,
  kpRange,
  sfiRange,
} from '../../lib/realismBounds.ts';
import { FormField, TextInput } from '../v2/index.ts';
import classes from './ManualDriverFields.module.css';

export interface ManualDriverFieldsProps {
  sfi: number;
  kp: number;
  onCommit: (sfi: number, kp: number) => void;
  unlocked?: boolean;
}

export default function ManualDriverFields({
  sfi,
  kp,
  onCommit,
  unlocked = false,
}: ManualDriverFieldsProps) {
  const [sfiDraft, setSfiDraft] = useState(String(sfi));
  const [kpDraft, setKpDraft] = useState(String(kp));
  const [editing, setEditing] = useState(false);
  const [lastSynced, setLastSynced] = useState({ sfi, kp });

  if ((sfi !== lastSynced.sfi || kp !== lastSynced.kp) && !editing) {
    setLastSynced({ sfi, kp });
    setSfiDraft(String(sfi));
    setKpDraft(String(kp));
  }

  const sfiBounds = sfiRange(unlocked);
  const kpBounds = kpRange(unlocked);

  function commit() {
    setEditing(false);
    const parsedSfi = Number(sfiDraft);
    const parsedKp = Number(kpDraft);
    const validSfi =
      Number.isFinite(parsedSfi) && parsedSfi > 0
        ? Math.min(sfiBounds.max, Math.max(sfiBounds.min, parsedSfi))
        : sfi;
    const validKp =
      Number.isFinite(parsedKp) && parsedKp >= 0 && parsedKp <= 9
        ? Math.min(kpBounds.max, Math.max(kpBounds.min, parsedKp))
        : kp;
    setSfiDraft(String(validSfi));
    setKpDraft(String(validKp));
    if (validSfi === sfi && validKp === kp) return;
    onCommit(validSfi, validKp);
  }

  return (
    <div className={classes.root}>
      <FormField
        label="SFI"
        error={
          isSfiOutOfRealisticBounds(sfi) ? 'Outside the realistic solar-cycle range' : undefined
        }
      >
        <TextInput
          variant="plain"
          type="number"
          min={sfiBounds.min}
          max={sfiBounds.max}
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
      <FormField
        label="Kp"
        error={isKpOutOfRealisticBounds(kp) ? 'Outside the 0-9 Kp scale' : undefined}
      >
        <TextInput
          variant="plain"
          type="number"
          min={kpBounds.min}
          max={kpBounds.max}
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
