// Named antennas as a Pill row with one-click active-antenna switching, plus
// a form shared by "+ Add antenna" and "Edit" (Slice 2, fix/reach-
// directionality-antenna-greyline -- antennas were create-only before this).
// Every write funnels through `mergeStation`, same as QthPicker.
import { useEffect, useState } from 'react';
import type { AntennaConfig, AntennaPatternFamily, Station } from '@core/domain/station/types';
import { mergeStation } from '@integrations/station/persistence';
import {
  Button,
  Combobox,
  FormField,
  Pill,
  SegmentedControl,
  TextInput,
  type ComboboxOption,
} from '../v2/index.ts';
import classes from './AntennaList.module.css';

export interface AntennaListProps {
  antennas: AntennaConfig[];
  activeAntennaId: string;
  onStationChange: (station: Station) => void;
  /**
   * Fires with the in-progress form's contents (Slice 3, fix/reach-
   * directionality-antenna-greyline), as a well-formed `AntennaConfig`
   * even before it's valid/submittable -- `null` whenever the form is
   * closed. Lets a caller (StationBar) preview the DRAFT being typed
   * instead of always showing the active antenna, which is wrong while
   * this form is open (the gap this slice fixes).
   */
  onDraftChange?: (draft: AntennaConfig | null) => void;
}

const FAMILY_OPTIONS: ComboboxOption<AntennaPatternFamily>[] = [
  { value: 'omnidirectional-vertical', label: 'Omnidirectional vertical' },
  { value: 'bidirectional-transverse', label: 'Bidirectional (dipole)' },
  { value: 'directional-lobe', label: 'Directional (beam)' },
  { value: 'multi-lobe-conical', label: 'Multi-lobe (long wire)' },
];

/**
 * Pattern families whose gain shape actually uses `phiDeg` (see
 * `antennaPattern.ts`'s `antennaGain` switch) -- the heading field only
 * makes sense for these. WIDENED (Slice 2) from `directional-lobe` alone
 * to also include `bidirectional-transverse`: a dipole's figure-eight has
 * a real azimuth term (`Math.abs(Math.cos(...))`), the form just never
 * exposed it. `multi-lobe-conical` stays excluded -- its azimuth term is
 * unused by the formula (a separate, out-of-scope gap, see this phase's
 * plan file), so a heading field for it would be a lie.
 */
const HEADING_FAMILIES = new Set<AntennaPatternFamily>([
  'directional-lobe',
  'bidirectional-transverse',
]);

function generateAntennaId(): string {
  return `antenna-${Math.random().toString(36).slice(2, 10)}`;
}

type BuildResult = { ok: true; antenna: AntennaConfig } | { ok: false; error: string };

export default function AntennaList({
  antennas,
  activeAntennaId,
  onStationChange,
  onDraftChange,
}: AntennaListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [familyQuery, setFamilyQuery] = useState('');
  const [family, setFamily] = useState<AntennaPatternFamily | null>(null);
  const [heightM, setHeightM] = useState('10');
  const [azimuthDeg, setAzimuthDeg] = useState('0');
  const [gainDbi, setGainDbi] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);

  // Slice 3: the in-progress form's contents, as a well-formed
  // AntennaConfig-shaped value even before it's valid/submittable -- `id`
  // is the antenna being edited (so the preview stays keyed on the same
  // antenna) or the literal 'draft' while adding a brand new one.
  // Deliberately NOT the same object `handleSubmit` would build (that one
  // validates and errors on a bad height/gain; this one is best-effort so
  // the preview never just goes blank while the operator is mid-keystroke).
  const draftAntenna: AntennaConfig | null =
    showForm && family
      ? {
          id: editingId ?? 'draft',
          name: name.trim() || 'New antenna',
          family,
          heightM: Number(heightM) || 0,
          gainDbi: Number(gainDbi) || 0,
          ...(HEADING_FAMILIES.has(family) ? { azimuthDeg: Number(azimuthDeg) || 0 } : {}),
        }
      : null;

  useEffect(() => {
    onDraftChange?.(draftAntenna);
    // draftAntenna is intentionally omitted -- it's a fresh object every
    // render; the primitives below are exactly what it's derived from, so
    // this still fires exactly when the draft's actual contents change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, editingId, name, family, heightM, azimuthDeg, gainDbi, onDraftChange]);

  function handleSelectActive(id: string) {
    if (id === activeAntennaId) return;
    onStationChange(mergeStation({ activeAntennaId: id }));
  }

  function resetForm() {
    setName('');
    setFamilyQuery('');
    setFamily(null);
    setHeightM('10');
    setAzimuthDeg('0');
    setGainDbi('0');
    setFormError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    resetForm();
  }

  /** Opens the shared form in "+ Add antenna" mode -- a blank draft, not tied to any existing antenna. */
  function handleStartAdd() {
    if (showForm && editingId === null) {
      closeForm();
      return;
    }
    resetForm();
    setEditingId(null);
    setShowForm(true);
  }

  /** Opens the shared form pre-filled with the currently-active antenna's fields (Slice 2's own edit-in-place). */
  function handleStartEdit() {
    const activeAntenna = antennas.find((antenna) => antenna.id === activeAntennaId);
    if (!activeAntenna) return;

    setName(activeAntenna.name);
    setFamilyQuery('');
    setFamily(activeAntenna.family);
    setHeightM(String(activeAntenna.heightM));
    setAzimuthDeg(String(activeAntenna.azimuthDeg ?? 0));
    setGainDbi(String(activeAntenna.gainDbi));
    setFormError(null);
    setEditingId(activeAntenna.id);
    setShowForm(true);
  }

  /** Validates the form fields and builds the `AntennaConfig` they describe -- shared by both add and edit submission. */
  function buildAntennaFromForm(id: string): BuildResult {
    const trimmedName = name.trim();
    const height = Number(heightM);
    const gain = Number(gainDbi);
    const azimuth = Number(azimuthDeg);

    if (!trimmedName) {
      return { ok: false, error: 'Enter a name for the antenna.' };
    }
    if (!family) {
      return { ok: false, error: 'Choose a pattern family.' };
    }
    if (!Number.isFinite(height) || height <= 0) {
      return { ok: false, error: 'Height must be a positive number.' };
    }
    if (!Number.isFinite(gain)) {
      return { ok: false, error: 'Gain must be a number.' };
    }

    return {
      ok: true,
      antenna: {
        id,
        name: trimmedName,
        family,
        heightM: height,
        gainDbi: gain,
        ...(HEADING_FAMILIES.has(family) && Number.isFinite(azimuth)
          ? { azimuthDeg: azimuth }
          : {}),
      },
    };
  }

  function handleSubmit() {
    const result = buildAntennaFromForm(editingId ?? generateAntennaId());
    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    if (editingId) {
      // Edit in place (Slice 2) -- REPLACES the existing entry, keeping its
      // id and position, rather than appending a near-duplicate.
      const updated = result.antenna;
      onStationChange(
        mergeStation({
          antennas: antennas.map((antenna) => (antenna.id === editingId ? updated : antenna)),
        }),
      );
    } else {
      onStationChange(mergeStation({ antennas: [...antennas, result.antenna] }));
    }

    closeForm();
  }

  const familyOption = family
    ? {
        value: family,
        label: FAMILY_OPTIONS.find((option) => option.value === family)?.label ?? family,
      }
    : null;
  const filteredFamilyOptions = FAMILY_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(familyQuery.trim().toLowerCase()),
  );

  const antennaOptions = antennas.map((ant) => ({ value: ant.id, label: ant.name }));
  const showHeadingField = family != null && HEADING_FAMILIES.has(family);

  return (
    <div className={classes.root}>
      <div className={classes.pillRow}>
        <SegmentedControl
          aria-label="Antennas"
          options={antennaOptions}
          value={activeAntennaId}
          onChange={handleSelectActive}
        />
        <Button variant="outline" size="sm" onClick={handleStartEdit}>
          Edit
        </Button>
        <Pill tone="dashed" onClick={handleStartAdd}>
          {showForm && editingId === null ? 'Cancel' : '+ Add antenna'}
        </Pill>
      </div>

      {showForm ? (
        <div className={classes.form}>
          <FormField label="Name">
            <TextInput
              variant="plain"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. 20m yagi"
            />
          </FormField>
          <FormField label="Pattern family">
            <Combobox
              value={familyOption}
              inputValue={familyQuery}
              onInputChange={setFamilyQuery}
              options={filteredFamilyOptions}
              onSelect={(option) => {
                setFamily(option.value);
                setFamilyQuery('');
              }}
              onClear={() => setFamily(null)}
              placeholder="Search pattern families…"
            />
          </FormField>
          <FormField label="Height above ground (m)">
            <TextInput
              variant="plain"
              type="number"
              aria-label="Height above ground (m)"
              value={heightM}
              onChange={(event) => setHeightM(event.target.value)}
            />
          </FormField>
          {showHeadingField ? (
            <FormField label="Heading (° azimuth)">
              <TextInput
                variant="plain"
                type="number"
                aria-label="Heading (° azimuth)"
                value={azimuthDeg}
                onChange={(event) => setAzimuthDeg(event.target.value)}
              />
            </FormField>
          ) : null}
          <FormField label="Gain (dBi)">
            <TextInput
              variant="plain"
              type="number"
              aria-label="Gain (dBi)"
              value={gainDbi}
              onChange={(event) => setGainDbi(event.target.value)}
            />
          </FormField>
          {formError ? <span className={classes.error}>{formError}</span> : null}
          <div className={classes.formActions}>
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              {editingId ? 'Save changes' : 'Add antenna'}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
