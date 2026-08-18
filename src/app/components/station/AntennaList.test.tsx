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
  it('switches the active antenna in one click', () => {
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

  it('adds a new antenna via the add-antenna form', () => {
    const onStationChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <AntennaList antennas={ANTENNAS} activeAntennaId="a1" onStationChange={onStationChange} />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByText('+ Add antenna'));
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

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
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

    // a1 (Dipole, bidirectional-transverse) has no azimuthDeg -- Edit should
    // default it to '0', per handleStartEdit's `?? 0` fallback.
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const headingInput = screen.getByLabelText('Heading (° azimuth)');
    expect(headingInput).toHaveValue(0);

    fireEvent.change(headingInput, { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(onStationChange).toHaveBeenCalledTimes(1);
    const station = onStationChange.mock.calls[0][0];
    expect(station.antennas[0].id).toBe('a1');
    expect(station.antennas[0].azimuthDeg).toBe(90);
  });
});
