// Band chip row (F4.8) — the trimmed amateur-HF catalogue
// (`@core/domain/bandCatalog`), one `Pill` per band, coloured via
// `BandDefinition.color`.
//
// "Outside the operator's licence class, visibly distinguished, not
// hidden" — flagged as a genuine spec gap, not silently invented:
// neither Station (phase 6) nor Conditions (this phase) defines a
// per-operator licence class, and none of the design docs specify what
// data model that criterion expects. This component's reasonable,
// minimal call: render each `BandDefinition.notes` string (e.g.
// "Secondary allocation") inline on its chip — Studio's Ofcom-sourced
// `notes` field already encodes exactly this kind of restriction
// information, surfacing it is a real, truthful "visibly distinguished"
// signal without inventing a licence-class selector this phase has no
// spec or UI slot for.
import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import { Pill } from '../v2/index.ts';
import classes from './BandChips.module.css';

export interface BandChipsProps {
  bandId: string;
  onChange: (bandId: string) => void;
}

export default function BandChips({ bandId, onChange }: BandChipsProps) {
  return (
    <div className={classes.root} role="group" aria-label="Band">
      {UK_AMATEUR_BANDS.map((band) => {
        const selected = band.id === bandId;
        return (
          <button
            key={band.id}
            type="button"
            className={[classes.chipButton, selected ? classes.selected : ''].join(' ')}
            aria-pressed={selected}
            onClick={() => onChange(band.id)}
          >
            <Pill tone="semantic" color={band.color}>
              {band.label}
              {band.notes ? <span className={classes.notes}> · {band.notes}</span> : null}
            </Pill>
          </button>
        );
      })}
    </div>
  );
}
