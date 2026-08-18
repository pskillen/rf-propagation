// Named antennas as a Pill row with one-click active-antenna switching. The
// shared add/edit form (Slice 2, fix/reach-directionality-antenna-greyline)
// used to sit behind a separate "Edit" click; this slice (feat/antenna-
// inline-edit) makes it always visible for whichever antenna is selected --
// selecting a pill immediately shows that antenna's editable fields, no
// second click required. "+ Add antenna" remains a distinct, always-
// available action for a blank draft not tied to any existing antenna.
// Every write funnels through `mergeStation`, same as QthPicker.
import { useEffect, useState } from 'react';
import type { AntennaConfig, AntennaPatternFamily, Station } from '@core/domain/station/types';
import { mergeStation } from '@integrations/station/persistence';
import {
  Button,
  Combobox,
  ConfirmModal,
  FormField,
  Pill,
  SegmentedControl,
  StatusDot,
  TextInput,
  type ComboboxOption,
} from '../v2/index.ts';
import classes from './AntennaList.module.css';

export interface AntennaListProps {
  antennas: AntennaConfig[];
  activeAntennaId: string;
  onStationChange: (station: Station) => void;
  /**
   * Fires with the in-progress form's contents, as a well-formed
   * `AntennaConfig` even before it's valid/submittable -- `null` only when
   * the form can't yet describe one (add mode, no pattern family chosen
   * yet). Lets a caller (StationBar) preview the DRAFT being typed instead
   * of always showing the active antenna. Since the form is now open
   * whenever an antenna is selected, this fires almost continuously --
   * `StationBar` still falls back to the active antenna for the brief
   * add-mode window before a family is picked.
   */
  onDraftChange?: (draft: AntennaConfig | null) => void;
}

// Label tightened (this slice) from "Multi-lobe (long wire)" -- the
// `multi-lobe-conical` id is left alone (persisted stations already store
// that string; renaming the id would need a load-path migration, see
// `tmp/mvp-plan/gaps/wire-antenna-configurations.md`), but the label now
// says what the formula actually models: a straight, level, resonant/
// travelling-wave long wire -- NOT an inverted-V, sloper, or inverted-L,
// none of which this formula's derivation represents.
const FAMILY_OPTIONS: ComboboxOption<AntennaPatternFamily>[] = [
  { value: 'omnidirectional-vertical', label: 'Omnidirectional vertical' },
  { value: 'bidirectional-transverse', label: 'Bidirectional (dipole)' },
  { value: 'directional-lobe', label: 'Directional (beam)' },
  { value: 'multi-lobe-conical', label: 'Long wire (straight, level)' },
];

/**
 * Pattern families whose gain shape actually uses `phiDeg` (see
 * `antennaPattern.ts`'s `antennaGain` switch) -- the heading field only
 * makes sense for these. WIDENED (Slice 2) from `directional-lobe` alone
 * to also include `bidirectional-transverse`: a dipole's figure-eight has
 * a real azimuth term (`Math.abs(Math.cos(...))`), the form just never
 * exposed it.
 *
 * WIDENED AGAIN (this slice) to also include `multi-lobe-conical`: a real
 * long wire's lobes DO point in specific compass directions along the
 * wire's run, so recording a heading is legitimate even though
 * `antennaGain`'s `multi-lobe-conical` case doesn't yet rotate its pattern
 * with `phiDeg` -- that's a real, separate, and already-flagged modelling
 * gap (see `AZIMUTH_NOT_MODELLED_HINT` below and
 * `tmp/mvp-plan/gaps/wire-antenna-configurations.md`), not a reason to
 * keep the operator from recording the antenna's actual orientation.
 */
const HEADING_FAMILIES = new Set<AntennaPatternFamily>([
  'directional-lobe',
  'bidirectional-transverse',
  'multi-lobe-conical',
]);

/**
 * Shown under the heading field only for `multi-lobe-conical`, where
 * recording an azimuth is honest (it's the wire's real-world run) but the
 * modelled pattern doesn't yet use it -- see `HEADING_FAMILIES`'s doc
 * comment. Consistent with how this codebase flags known-deviations inline
 * rather than silently implying full support.
 */
const AZIMUTH_NOT_MODELLED_HINT =
  "Recorded, but the long-wire pattern doesn't yet rotate with it -- see gaps/wire-antenna-configurations.md.";

function generateAntennaId(): string {
  return `antenna-${Math.random().toString(36).slice(2, 10)}`;
}

type BuildResult = { ok: true; antenna: AntennaConfig } | { ok: false; error: string };

/** What the form is currently showing: an existing antenna's saved fields, or a blank not-yet-saved draft. */
type FormMode = 'edit' | 'add';

/** A switch the operator has asked for -- may need to go through the unsaved-changes guard before it actually happens. */
type SwitchTarget = { kind: 'edit'; id: string } | { kind: 'add' };

interface FormFieldValues {
  name: string;
  family: AntennaPatternFamily | null;
  heightM: string;
  azimuthDeg: string;
  gainDbi: string;
}

const BLANK_FIELDS: FormFieldValues = {
  name: '',
  family: null,
  heightM: '10',
  azimuthDeg: '0',
  gainDbi: '0',
};

function fieldsFromAntenna(antenna: AntennaConfig | undefined): FormFieldValues {
  if (!antenna) return BLANK_FIELDS;
  return {
    name: antenna.name,
    family: antenna.family,
    heightM: String(antenna.heightM),
    azimuthDeg: String(antenna.azimuthDeg ?? 0),
    gainDbi: String(antenna.gainDbi),
  };
}

/**
 * Drops the heading field from the comparison when the current family
 * doesn't use it -- `azimuthDeg` drifting in a hidden field shouldn't read
 * as "unsaved changes" the operator can't even see.
 */
function normalizeForComparison(fields: FormFieldValues) {
  return {
    name: fields.name,
    family: fields.family,
    heightM: fields.heightM,
    gainDbi: fields.gainDbi,
    azimuthDeg: fields.family && HEADING_FAMILIES.has(fields.family) ? fields.azimuthDeg : null,
  };
}

export default function AntennaList({
  antennas,
  activeAntennaId,
  onStationChange,
  onDraftChange,
}: AntennaListProps) {
  const initialActive = antennas.find((antenna) => antenna.id === activeAntennaId);
  const initialFields = fieldsFromAntenna(initialActive);

  const [formMode, setFormMode] = useState<FormMode>('edit');
  const [editingId, setEditingId] = useState<string | null>(initialActive?.id ?? null);
  const [name, setName] = useState(initialFields.name);
  const [familyQuery, setFamilyQuery] = useState('');
  const [family, setFamily] = useState<AntennaPatternFamily | null>(initialFields.family);
  const [heightM, setHeightM] = useState(initialFields.heightM);
  const [azimuthDeg, setAzimuthDeg] = useState(initialFields.azimuthDeg);
  const [gainDbi, setGainDbi] = useState(initialFields.gainDbi);
  const [formError, setFormError] = useState<string | null>(null);
  // What the form looked like the moment it was last loaded or saved --
  // the dirty check compares the live fields against THIS, not against
  // `antennas` directly. Tracking it locally (rather than re-deriving from
  // the `antennas` prop on every render) means the "Unsaved changes"
  // indicator clears the instant Save succeeds, without depending on the
  // parent having already round-tripped the new value back down as props.
  const [savedSnapshot, setSavedSnapshot] = useState<FormFieldValues>(initialFields);
  // Set while a pill click (or "+ Add antenna") would discard unsaved edits
  // -- holds the switch until the operator confirms or cancels it. See
  // `docs/features/station/antenna-model.md`'s "Inline edit" section for
  // why this guard exists only for implicit switches, not explicit Cancel.
  const [pendingSwitch, setPendingSwitch] = useState<SwitchTarget | null>(null);

  // The in-progress form's contents, as a well-formed AntennaConfig-shaped
  // value even before it's valid/submittable -- `id` is the antenna being
  // edited, or the literal 'draft' while adding a brand new one.
  // Deliberately NOT the same object `handleSubmit` would build (that one
  // validates and errors on a bad height/gain; this one is best-effort so
  // the preview never just goes blank while the operator is mid-keystroke).
  const draftAntenna: AntennaConfig | null = family
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
  }, [editingId, name, family, heightM, azimuthDeg, gainDbi, onDraftChange]);

  const baseline = normalizeForComparison(savedSnapshot);
  const current = normalizeForComparison({ name, family, heightM, azimuthDeg, gainDbi });
  const isDirty =
    current.name !== baseline.name ||
    current.family !== baseline.family ||
    current.heightM !== baseline.heightM ||
    current.gainDbi !== baseline.gainDbi ||
    current.azimuthDeg !== baseline.azimuthDeg;

  function loadAntennaIntoForm(id: string) {
    const antenna = antennas.find((candidate) => candidate.id === id);
    const fields = fieldsFromAntenna(antenna);
    setName(fields.name);
    setFamilyQuery('');
    setFamily(fields.family);
    setHeightM(fields.heightM);
    setAzimuthDeg(fields.azimuthDeg);
    setGainDbi(fields.gainDbi);
    setFormError(null);
    setSavedSnapshot(fields);
  }

  function resetFormToBlank() {
    setName(BLANK_FIELDS.name);
    setFamilyQuery('');
    setFamily(BLANK_FIELDS.family);
    setHeightM(BLANK_FIELDS.heightM);
    setAzimuthDeg(BLANK_FIELDS.azimuthDeg);
    setGainDbi(BLANK_FIELDS.gainDbi);
    setFormError(null);
    setSavedSnapshot(BLANK_FIELDS);
  }

  /** Unconditionally performs a switch -- callers decide whether it needs the unsaved-changes guard first. */
  function performSwitch(target: SwitchTarget) {
    if (target.kind === 'add') {
      resetFormToBlank();
      setFormMode('add');
      setEditingId(null);
    } else {
      loadAntennaIntoForm(target.id);
      setFormMode('edit');
      setEditingId(target.id);
      if (target.id !== activeAntennaId) {
        onStationChange(mergeStation({ activeAntennaId: target.id }));
      }
    }
    setPendingSwitch(null);
  }

  /**
   * Judgment call: switching what the form displays while it has unsaved
   * edits is gated behind a confirm -- there's no undo in this app, and a
   * pill click is easy to fire by accident while mid-edit. Explicit
   * discard actions (the form's own Cancel, re-clicking "+ Add antenna"
   * to back out of it) skip this guard -- the operator already said
   * "discard" in those cases, a second prompt would just be noise.
   */
  function requestSwitch(target: SwitchTarget) {
    if (isDirty) {
      setPendingSwitch(target);
      return;
    }
    performSwitch(target);
  }

  function handleSelectActive(id: string) {
    if (formMode === 'edit' && editingId === id) return;
    requestSwitch({ kind: 'edit', id });
  }

  /** Toggles the shared form in and out of "+ Add antenna" mode -- a blank draft, not tied to any existing antenna. */
  function handleStartAdd() {
    if (formMode === 'add') {
      // Re-clicking the toggle is an explicit "cancel add" -- no guard.
      performSwitch({ kind: 'edit', id: activeAntennaId });
      return;
    }
    requestSwitch({ kind: 'add' });
  }

  /** The form's own Cancel -- always an explicit discard, never gated behind the switch-guard. */
  function handleCancel() {
    if (formMode === 'add') {
      performSwitch({ kind: 'edit', id: activeAntennaId });
      return;
    }
    loadAntennaIntoForm(editingId ?? activeAntennaId);
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
      // Edit in place -- REPLACES the existing entry, keeping its id and
      // position, rather than appending a near-duplicate. Stays in edit
      // mode for the same antenna afterwards; `savedSnapshot` is updated
      // to the just-submitted values below so the dirty indicator clears
      // immediately, without waiting on `antennas` to round-trip back.
      const updated = result.antenna;
      onStationChange(
        mergeStation({
          antennas: antennas.map((antenna) => (antenna.id === editingId ? updated : antenna)),
        }),
      );
      setFormError(null);
      setSavedSnapshot(fieldsFromAntenna(updated));
    } else {
      // Judgment call: adding a new antenna does NOT auto-activate it
      // (matches the prior add-only behaviour) -- the form returns to
      // showing whichever antenna is currently active, same place Cancel
      // would leave it. The new antenna is visible in the pill row;
      // clicking its pill both activates and edits it, same as any other.
      onStationChange(mergeStation({ antennas: [...antennas, result.antenna] }));
      performSwitch({ kind: 'edit', id: activeAntennaId });
    }
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

  const pendingSwitchAwayFromLabel =
    formMode === 'add'
      ? 'the new antenna'
      : (antennas.find((a) => a.id === editingId)?.name ?? 'this antenna');
  const pendingSwitchToLabel =
    pendingSwitch?.kind === 'edit'
      ? (antennas.find((a) => a.id === pendingSwitch.id)?.name ?? 'that antenna')
      : 'a new antenna';

  return (
    <div className={classes.root}>
      <div className={classes.pillRow}>
        <SegmentedControl
          aria-label="Antennas"
          options={antennaOptions}
          value={activeAntennaId}
          onChange={handleSelectActive}
        />
        <Pill tone="dashed" onClick={handleStartAdd}>
          {formMode === 'add' ? 'Cancel' : '+ Add antenna'}
        </Pill>
      </div>

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
          <FormField
            label="Heading (° azimuth)"
            hint={family === 'multi-lobe-conical' ? AZIMUTH_NOT_MODELLED_HINT : undefined}
          >
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
          {isDirty ? <StatusDot tone="warning" label="Unsaved changes" /> : <span />}
          <div className={classes.formButtons}>
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit}>
              {formMode === 'edit' ? 'Save changes' : 'Add antenna'}
            </Button>
          </div>
        </div>
      </div>

      {/* `inline` (panel markup only, no overlay/portal) -- this is a small
          in-panel confirmation next to the pill row it was triggered from,
          not a page-level interruption, and it keeps the guard trivially
          testable without depending on Mantine's Modal portal. */}
      <ConfirmModal
        open={pendingSwitch !== null}
        onClose={() => setPendingSwitch(null)}
        onConfirm={() => pendingSwitch && performSwitch(pendingSwitch)}
        title="Discard unsaved changes?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="destructive"
        inline
      >
        {pendingSwitch?.kind === 'add'
          ? `Switching to add a new antenna will discard your unsaved changes to ${pendingSwitchAwayFromLabel}.`
          : `Switching to ${pendingSwitchToLabel} will discard your unsaved changes to ${pendingSwitchAwayFromLabel}.`}
      </ConfirmModal>
    </div>
  );
}
