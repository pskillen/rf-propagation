import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { ViewerStateProvider } from '../../state/viewerState.tsx';
import StationBar from './StationBar.tsx';

vi.mock('./QthMap.tsx', () => ({
  default: () => <div data-testid="qth-map-stub" />,
}));

beforeEach(() => {
  localStorage.clear();
});

function renderBar() {
  return render(
    <ViewerStateProvider>
      <DesignSystemV2Provider>
        <StationBar />
      </DesignSystemV2Provider>
    </ViewerStateProvider>,
  );
}

describe('StationBar', () => {
  it('renders a populated default station on first load, no wizard/modal/empty state', () => {
    renderBar();

    expect(screen.getByTestId('station-bar')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(DEFAULT_STATION.qth.locator))).toBeInTheDocument();
    expect(screen.getByText(/40m dipole/)).toBeInTheDocument();
    expect(screen.getByText(/100 W/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the TX power field is reachable and functional without clicking Edit', () => {
    renderBar();

    // Not behind the "Edit station" toggle — visible from first paint.
    const input = screen.getByLabelText('TX power (W)');
    expect(input).toBeEnabled();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '400' } });
    fireEvent.blur(input);

    expect(screen.getByText(/400 W/)).toBeInTheDocument();
  });

  it('reveals QTH, Antennas and Noise environment sections behind the Edit toggle', () => {
    renderBar();

    expect(screen.queryByText('QTH')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit station' }));

    expect(screen.getByText('QTH')).toBeInTheDocument();
    expect(screen.getByText('Antennas')).toBeInTheDocument();
    expect(screen.getByText('Noise environment')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('QTH')).not.toBeInTheDocument();
  });

  it('persists a change across a fresh mount (simulated reload)', () => {
    const first = renderBar();
    const input = screen.getByLabelText('TX power (W)');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '250' } });
    fireEvent.blur(input);
    first.unmount();

    renderBar();
    expect(screen.getByText(/250 W/)).toBeInTheDocument();
  });

  /** The pattern preview's own SVG -- picked out of the tree by its aria-label, not just "the first <path>" (icons in the form also render <path>s). */
  function previewPath() {
    return screen
      .getByRole('img', { name: /elevation gain pattern/i })
      .querySelector('path')
      ?.getAttribute('d');
  }

  function selectFamily(optionLabel: string) {
    // Combobox swaps to a committed chip + "Change" link once a value is
    // selected -- re-open search mode first if editing prefilled one.
    const changeLink = screen.queryByText('Change');
    if (changeLink) fireEvent.click(changeLink);

    const familyInput = screen.getByPlaceholderText('Search pattern families…');
    fireEvent.focus(familyInput);
    fireEvent.change(familyInput, { target: { value: optionLabel } });
    fireEvent.click(screen.getByText(optionLabel));
  }

  describe('Slice 3 -- pattern preview reflects the in-progress form draft', () => {
    it('opening "+ Add antenna" and changing the height field updates the preview before submitting', () => {
      renderBar();
      fireEvent.click(screen.getByRole('button', { name: 'Edit station' }));
      const initialPath = previewPath();

      fireEvent.click(screen.getByText('+ Add antenna'));
      selectFamily('Directional (beam)');
      fireEvent.change(screen.getByLabelText('Height above ground (m)'), {
        target: { value: '20' },
      });

      const draftPath = previewPath();
      expect(draftPath).toBeTruthy();
      expect(draftPath).not.toBe(initialPath);
    });

    it('closing the form without submitting reverts the preview to the active antenna', () => {
      renderBar();
      fireEvent.click(screen.getByRole('button', { name: 'Edit station' }));
      const initialPath = previewPath();

      fireEvent.click(screen.getByText('+ Add antenna'));
      selectFamily('Directional (beam)');
      fireEvent.change(screen.getByLabelText('Height above ground (m)'), {
        target: { value: '20' },
      });
      expect(previewPath()).not.toBe(initialPath);

      // Two "Cancel"-labelled buttons exist while the form is open (the
      // toggle Pill re-labels itself, and the form's own Cancel action) --
      // the form's own is the one inside the form itself (DOM order: pill
      // row, then form).
      const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButtons[cancelButtons.length - 1]);
      expect(previewPath()).toBe(initialPath);
    });

    it('editing the active antenna previews its draft, not the stale pre-edit display', () => {
      renderBar();
      fireEvent.click(screen.getByRole('button', { name: 'Edit station' }));
      const initialPath = previewPath();

      // Edit the default station's own dipole -- switching its family to a
      // beam should visibly change the preview's shape immediately, before
      // "Save changes" is ever clicked.
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      selectFamily('Directional (beam)');

      const draftPath = previewPath();
      expect(draftPath).toBeTruthy();
      expect(draftPath).not.toBe(initialPath);
    });
  });
});
