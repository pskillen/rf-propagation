import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import type { AntennaConfig } from '@core/domain/station/types';
import AntennaList from './AntennaList.tsx';

const ANTENNAS: AntennaConfig[] = [
  { id: 'a1', name: 'Dipole', family: 'bidirectional-transverse', heightM: 7, gainDbi: 2.1 },
  { id: 'a2', name: 'Vertical', family: 'omnidirectional-vertical', heightM: 3, gainDbi: 0 },
];

beforeEach(() => {
  localStorage.clear();
});

describe('AntennaList', () => {
  it("shows the active antenna's form pre-filled immediately, with no separate Edit click", () => {
    const onStationChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
      </DesignSystemV2Provider>,
    );

    // No "Edit" affordance exists any more -- the form for the active
    // antenna (a1, Dipole) is visible from first paint.
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 20m yagi')).toHaveValue('Dipole');
    expect(screen.getByLabelText('Height above ground (m)')).toHaveValue(7);
    expect(screen.getByLabelText('Gain (dBi)')).toHaveValue(2.1);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('switches the active antenna in one click, and its form appears immediately', () => {
    const onStationChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByText('Vertical'));

    expect(onStationChange).toHaveBeenCalledTimes(1);
    const station = onStationChange.mock.calls[0][0];
    expect(station.activeAntennaId).toBe('a2');

    // The form now shows a2's own saved values, not a1's.
    expect(screen.getByPlaceholderText('e.g. 20m yagi')).toHaveValue('Vertical');
    expect(screen.getByLabelText('Height above ground (m)')).toHaveValue(3);
  });

  it('does not call onStationChange when clicking the already-active antenna', () => {
    const onStationChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByText('Dipole'));
    expect(onStationChange).not.toHaveBeenCalled();
  });

  it("adds a new antenna via the add-antenna form, which starts blank -- not the active antenna's values", () => {
    const onStationChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByText('+ Add antenna'));

    // Blank draft, not a1's pre-filled values.
    expect(screen.getByPlaceholderText('e.g. 20m yagi')).toHaveValue('');
    expect(screen.getByLabelText('Height above ground (m)')).toHaveValue(10);
    expect(screen.getByRole('button', { name: 'Add antenna' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('e.g. 20m yagi'), {
      target: { value: '6m beam' },
    });

    const familyInput = screen.getByPlaceholderText('Search pattern families…');
    fireEvent.focus(familyInput);
    fireEvent.change(familyInput, { target: { value: 'Directional' } });
    fireEvent.click(screen.getByText('Directional (beam)'));

    fireEvent.click(screen.getByRole('button', { name: 'Add antenna' }));

    expect(onStationChange).toHaveBeenCalledTimes(1);
    const station = onStationChange.mock.calls[0][0];
    expect(station.antennas).toHaveLength(3);
    const added = station.antennas[2];
    expect(added.name).toBe('6m beam');
    expect(added.family).toBe('directional-lobe');
    expect(added.heightM).toBe(10);

    // Adding doesn't auto-activate the new antenna -- the form returns to
    // showing the still-active a1 (judgment call, see antenna-model.md).
    expect(screen.getByPlaceholderText('e.g. 20m yagi')).toHaveValue('Dipole');
  });

  it('shows an error and does not call onStationChange when the name is empty', () => {
    const onStationChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByText('+ Add antenna'));
    fireEvent.click(screen.getByRole('button', { name: 'Add antenna' }));

    expect(onStationChange).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a name/i)).toBeInTheDocument();
  });

  it("edits the active antenna's height in place, without changing its id or appending a new entry", () => {
    const onStationChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
      </DesignSystemV2Provider>,
    );

    const heightInput = screen.getByLabelText('Height above ground (m)');
    expect(heightInput).toHaveValue(7);

    fireEvent.change(heightInput, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onStationChange).toHaveBeenCalledTimes(1);
    const station = onStationChange.mock.calls[0][0];
    expect(station.antennas).toHaveLength(2);
    expect(station.antennas[0].id).toBe('a1');
    expect(station.antennas[0].heightM).toBe(12);
    expect(station.antennas[0].name).toBe('Dipole');
  });

  it('shows the heading field for directional-lobe and bidirectional-transverse, and hides it for the other two families', () => {
    const onStationChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByText('+ Add antenna'));

    // Combobox swaps to a committed chip + "Change" link once a value is
    // selected (see Combobox.tsx) -- re-open search mode before each pick.
    function selectFamily(query: string, optionLabel: string) {
      const changeLink = screen.queryByText('Change');
      if (changeLink) fireEvent.click(changeLink);

      const familyInput = screen.getByPlaceholderText('Search pattern families…');
      fireEvent.focus(familyInput);
      fireEvent.change(familyInput, { target: { value: query } });
      fireEvent.click(screen.getByText(optionLabel));
    }

    selectFamily('Directional', 'Directional (beam)');
    expect(screen.getByLabelText('Heading (° azimuth)')).toBeInTheDocument();

    selectFamily('Bidirectional', 'Bidirectional (dipole)');
    expect(screen.getByLabelText('Heading (° azimuth)')).toBeInTheDocument();

    selectFamily('Omnidirectional', 'Omnidirectional vertical');
    expect(screen.queryByLabelText('Heading (° azimuth)')).not.toBeInTheDocument();

    selectFamily('Multi-lobe', 'Multi-lobe (long wire)');
    expect(screen.queryByLabelText('Heading (° azimuth)')).not.toBeInTheDocument();
  });

  it("an edited dipole's azimuthDeg round-trips through mergeStation correctly", () => {
    const onStationChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
      </DesignSystemV2Provider>,
    );

    // a1 (Dipole, bidirectional-transverse) has no azimuthDeg -- the
    // heading field defaults it to '0' (fieldsFromAntenna's `?? 0`
    // fallback), and it's visible immediately since the form is always
    // showing the active antenna now.
    const headingInput = screen.getByLabelText('Heading (° azimuth)');
    expect(headingInput).toHaveValue(0);

    fireEvent.change(headingInput, { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onStationChange).toHaveBeenCalledTimes(1);
    const station = onStationChange.mock.calls[0][0];
    expect(station.antennas[0].id).toBe('a1');
    expect(station.antennas[0].azimuthDeg).toBe(90);
  });

  describe('unsaved-changes indicator', () => {
    it('appears once a field is edited, and clears after Save', () => {
      const onStationChange = vi.fn();
      render(
        <DesignSystemV2Provider>
          <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
        </DesignSystemV2Provider>,
      );

      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Height above ground (m)'), {
        target: { value: '12' },
      });
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    });

    it('clears when the edit is discarded via the form Cancel button', () => {
      const onStationChange = vi.fn();
      render(
        <DesignSystemV2Provider>
          <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
        </DesignSystemV2Provider>,
      );

      fireEvent.change(screen.getByLabelText('Height above ground (m)'), {
        target: { value: '12' },
      });
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Height above ground (m)')).toHaveValue(7);
      expect(onStationChange).not.toHaveBeenCalled();
    });
  });

  describe('switching the active antenna while the form is dirty', () => {
    it('prompts a confirm instead of silently discarding the edit', () => {
      const onStationChange = vi.fn();
      render(
        <DesignSystemV2Provider>
          <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
        </DesignSystemV2Provider>,
      );

      fireEvent.change(screen.getByLabelText('Height above ground (m)'), {
        target: { value: '12' },
      });

      fireEvent.click(screen.getByText('Vertical'));

      // Station's activeAntennaId hasn't moved yet -- the switch is pending.
      expect(onStationChange).not.toHaveBeenCalled();
      expect(screen.getByText(/discard unsaved changes/i)).toBeInTheDocument();
      // The dirty a1 form is still showing underneath the confirm.
      expect(screen.getByLabelText('Height above ground (m)')).toHaveValue(12);
    });

    it('keeps the in-progress edit when the confirm is dismissed', () => {
      const onStationChange = vi.fn();
      render(
        <DesignSystemV2Provider>
          <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
        </DesignSystemV2Provider>,
      );

      fireEvent.change(screen.getByLabelText('Height above ground (m)'), {
        target: { value: '12' },
      });
      fireEvent.click(screen.getByText('Vertical'));
      fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));

      expect(onStationChange).not.toHaveBeenCalled();
      expect(screen.queryByText(/discard unsaved changes/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText('Height above ground (m)')).toHaveValue(12);
      expect(screen.getByPlaceholderText('e.g. 20m yagi')).toHaveValue('Dipole');
    });

    it('discards the edit and switches once confirmed', () => {
      const onStationChange = vi.fn();
      render(
        <DesignSystemV2Provider>
          <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
        </DesignSystemV2Provider>,
      );

      fireEvent.change(screen.getByLabelText('Height above ground (m)'), {
        target: { value: '12' },
      });
      fireEvent.click(screen.getByText('Vertical'));
      fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

      expect(onStationChange).toHaveBeenCalledTimes(1);
      const station = onStationChange.mock.calls[0][0];
      expect(station.activeAntennaId).toBe('a2');

      // The now-shown a2 form has its own saved values, not a1's discarded edit.
      expect(screen.getByPlaceholderText('e.g. 20m yagi')).toHaveValue('Vertical');
      expect(screen.getByLabelText('Height above ground (m)')).toHaveValue(3);
    });

    it('does not prompt when the form has no unsaved edits', () => {
      const onStationChange = vi.fn();
      render(
        <DesignSystemV2Provider>
          <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
        </DesignSystemV2Provider>,
      );

      fireEvent.click(screen.getByText('Vertical'));

      expect(screen.queryByText(/discard unsaved changes/i)).not.toBeInTheDocument();
      expect(onStationChange).toHaveBeenCalledTimes(1);
    });
  });
});
