/**
 * Timeline's reference-distance/bearing control (F11.1, [#73]) — shown
 * only when `target === null` (Reach mode; Path already has a target).
 * Direct manipulation isn't a plausible primary route here (there's no
 * natural drag target for "a distance and bearing with no marker on a
 * map or globe") — numeric fields are an acceptable primary input for
 * this ONE control, a deliberate exception to FR-28's direct-
 * manipulation-first rule (which governs station/target/heading/time,
 * not this), per this phase's own plan file.
 *
 * Local-draft + blur-commit, matching `PowerInput.tsx`'s own lighter-
 * weight version of the debounced-inputs skill's committed+commit
 * pattern (the full `useDebouncedOptionalNumberField` hook still doesn't
 * exist in this repo — see that skill's own doc comment — and this
 * control's inputs are exactly as simple as `PowerInput`'s: no drag/
 * slider, no per-keystroke engine re-run to avoid beyond the ordinary
 * "don't write every keystroke" concern).
 *
 * [#73]: https://github.com/pskillen/rf-propagation/issues/73
 */
import { useState } from 'react';
import { FormField, TextInput } from '../../components/v2/index.ts';
import type { TimelineState } from '../../state/timeline.ts';
import classes from './ReferenceDistanceControl.module.css';

export interface ReferenceDistanceControlProps {
  value: TimelineState;
  onChange: (next: TimelineState) => void;
}

const MIN_DISTANCE_KM = 1;
const MAX_DISTANCE_KM = 20_000;

export default function ReferenceDistanceControl({
  value,
  onChange,
}: ReferenceDistanceControlProps) {
  const [distanceDraft, setDistanceDraft] = useState(String(value.referenceDistanceKm));
  const [bearingDraft, setBearingDraft] = useState(String(value.referenceBearingDeg));
  const [editing, setEditing] = useState(false);
  // Same "adjust state during render on a prop change" pattern as
  // `PowerInput.tsx` -- avoids an effect that would setState synchronously
  // on every external `value` change and trigger a cascading extra render.
  const [lastSynced, setLastSynced] = useState(value);
  if (
    !editing &&
    (value.referenceDistanceKm !== lastSynced.referenceDistanceKm ||
      value.referenceBearingDeg !== lastSynced.referenceBearingDeg)
  ) {
    setLastSynced(value);
    setDistanceDraft(String(value.referenceDistanceKm));
    setBearingDraft(String(value.referenceBearingDeg));
  }

  function commit() {
    setEditing(false);
    const parsedDistance = Number(distanceDraft);
    const parsedBearing = Number(bearingDraft);

    const distanceKm = Number.isFinite(parsedDistance)
      ? Math.min(MAX_DISTANCE_KM, Math.max(MIN_DISTANCE_KM, parsedDistance))
      : value.referenceDistanceKm;
    const bearingDeg = Number.isFinite(parsedBearing)
      ? ((parsedBearing % 360) + 360) % 360
      : value.referenceBearingDeg;

    setDistanceDraft(String(distanceKm));
    setBearingDraft(String(bearingDeg));

    if (distanceKm === value.referenceDistanceKm && bearingDeg === value.referenceBearingDeg)
      return;
    onChange({ referenceDistanceKm: distanceKm, referenceBearingDeg: bearingDeg });
  }

  return (
    <div className={classes.root}>
      <FormField label="Reference distance (km)">
        <TextInput
          variant="plain"
          type="number"
          aria-label="Reference distance (km)"
          min={MIN_DISTANCE_KM}
          max={MAX_DISTANCE_KM}
          value={distanceDraft}
          onFocus={() => setEditing(true)}
          onChange={(event) => setDistanceDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
      </FormField>
      <FormField label="Reference bearing (°T)">
        <TextInput
          variant="plain"
          type="number"
          aria-label="Reference bearing (°T)"
          min={0}
          max={360}
          value={bearingDraft}
          onFocus={() => setEditing(true)}
          onChange={(event) => setBearingDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
      </FormField>
    </div>
  );
}
