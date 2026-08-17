// Named antennas as a Pill row with one-click active-antenna switching, plus
// an "add antenna" form. Every write funnels through `mergeStation`, same
// as QthPicker.
import { useState } from 'react';
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
}

const FAMILY_OPTIONS: ComboboxOption<AntennaPatternFamily>[] = [
  { value: 'omnidirectional-vertical', label: 'Omnidirectional vertical' },
  { value: 'bidirectional-transverse', label: 'Bidirectional (dipole)' },
  { value: 'directional-lobe', label: 'Directional (beam)' },
  { value: 'multi-lobe-conical', label: 'Multi-lobe (long wire)' },
];

function generateAntennaId(): string {
  return `antenna-${Math.random().toString(36).slice(2, 10)}`;
}

export default function AntennaList({
  antennas,
  activeAntennaId,
  onStationChange,
}: AntennaListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [familyQuery, setFamilyQuery] = useState('');
  const [family, setFamily] = useState<AntennaPatternFamily | null>(null);
  const [heightM, setHeightM] = useState('10');
  const [azimuthDeg, setAzimuthDeg] = useState('0');
  const [gainDbi, setGainDbi] = useState('0');
  const [formError, setFormError] = useState<string | null>(null);

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

  function handleAddAntenna() {
    const trimmedName = name.trim();
    const height = Number(heightM);
    const gain = Number(gainDbi);
    const azimuth = Number(azimuthDeg);

    if (!trimmedName) {
      setFormError('Enter a name for the antenna.');
      return;
    }
    if (!family) {
      setFormError('Choose a pattern family.');
      return;
    }
    if (!Number.isFinite(height) || height <= 0) {
      setFormError('Height must be a positive number.');
      return;
    }
    if (!Number.isFinite(gain)) {
      setFormError('Gain must be a number.');
      return;
    }

    const newAntenna: AntennaConfig = {
      id: generateAntennaId(),
      name: trimmedName,
      family,
      heightM: height,
      gainDbi: gain,
      ...(family === 'directional-lobe' && Number.isFinite(azimuth) ? { azimuthDeg: azimuth } : {}),
    };

    onStationChange(mergeStation({ antennas: [...antennas, newAntenna] }));
    resetForm();
    setShowAddForm(false);
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

  return (
    <div className={classes.root}>
      <div className={classes.pillRow}>
        <SegmentedControl
          aria-label="Antennas"
          options={antennaOptions}
          value={activeAntennaId}
          onChange={handleSelectActive}
        />
        <Pill tone="dashed" onClick={() => setShowAddForm((visible) => !visible)}>
          {showAddForm ? 'Cancel' : '+ Add antenna'}
        </Pill>
      </div>

      {showAddForm ? (
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
              value={heightM}
              onChange={(event) => setHeightM(event.target.value)}
            />
          </FormField>
          {family === 'directional-lobe' ? (
            <FormField label="Heading (° azimuth)">
              <TextInput
                variant="plain"
                type="number"
                value={azimuthDeg}
                onChange={(event) => setAzimuthDeg(event.target.value)}
              />
            </FormField>
          ) : null}
          <FormField label="Gain (dBi)">
            <TextInput
              variant="plain"
              type="number"
              value={gainDbi}
              onChange={(event) => setGainDbi(event.target.value)}
            />
          </FormField>
          {formError ? <span className={classes.error}>{formError}</span> : null}
          <div className={classes.formActions}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddForm(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddAntenna}>
              Add antenna
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
