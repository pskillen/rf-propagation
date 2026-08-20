import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { ViewerStateProvider, useViewerState } from '../../state/viewerState.tsx';
import StationBar from './StationBar.tsx';

// F7.3 (phase 10's Slice 3) lives on `ViewerState.playback.unrealismUnlocked`,
// which only `ConditionsBar`'s own toggle writes in the real app -- this
// probe stands in for that toggle so StationBar's own unlocked-bounds/
// clamp-on-lock behaviour can be exercised in isolation.
function UnlockProbe() {
  const { state, setState } = useViewerState();
  return (
    <button
      type="button"
      onClick={() =>
        setState((prev) => ({
          ...prev,
          playback: { ...prev.playback, unrealismUnlocked: !prev.playback.unrealismUnlocked },
        }))
      }
    >
      unlocked: {String(state.playback.unrealismUnlocked)}
    </button>
  );
}

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

function renderBarWithUnlockProbe() {
  return render(
    <ViewerStateProvider>
      <DesignSystemV2Provider>
        <UnlockProbe />
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

  /**
   * The pattern preview's own parallel-cut SVG -- picked out of the tree
   * by its aria-label, not just "the first <path>" (icons in the form
   * also render <path>s, and Slice 4 added two more pattern-preview
   * panels besides this one).
   */
  function previewPath() {
    return screen
      .getByRole('img', { name: /elevation gain pattern \(parallel cut\)/i })
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

    it("editing the active antenna's form previews its draft, not the stale pre-edit display", () => {
      renderBar();
      fireEvent.click(screen.getByRole('button', { name: 'Edit station' }));
      const initialPath = previewPath();

      // The default station's own dipole form is already open (no
      // separate "Edit" click needed) -- switching its family to a beam
      // should visibly change the preview's shape immediately, before
      // "Save changes" is ever clicked.
      selectFamily('Directional (beam)');

      const draftPath = previewPath();
      expect(draftPath).toBeTruthy();
      expect(draftPath).not.toBe(initialPath);
    });
  });

  describe('realism unlock (F7.3)', () => {
    it('toggling off clamps an out-of-range TX power back into the realistic range', () => {
      renderBarWithUnlockProbe();
      fireEvent.click(screen.getByRole('button', { name: /unlocked: false/ }));

      const input = screen.getByLabelText('TX power (W)');
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '5000' } });
      fireEvent.blur(input);
      expect(screen.getByText(/5000 W/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /unlocked: true/ }));
      expect(screen.getByText(/1500 W/)).toBeInTheDocument();
    });

    it('toggling off clamps an out-of-range active-antenna height back into the realistic range', () => {
      renderBarWithUnlockProbe();
      fireEvent.click(screen.getByRole('button', { name: /unlocked: false/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Edit station' }));

      fireEvent.change(screen.getByLabelText('Height above ground (m)'), {
        target: { value: '100' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(screen.getByText(/@ 100 m/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /unlocked: true/ }));
      expect(screen.getByText(/@ 30 m/)).toBeInTheDocument();
    });
  });
});
