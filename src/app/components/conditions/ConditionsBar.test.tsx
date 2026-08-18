import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ConditionsBar from './ConditionsBar.tsx';

const mockFetchLatestSpaceWeather = vi.fn();
const mockLoadLastKnownDriver = vi.fn();
const mockSaveLastKnownDriver = vi.fn();

vi.mock('@integrations/spaceWeather/noaaClient', () => ({
  fetchLatestSpaceWeather: (...args: unknown[]) => mockFetchLatestSpaceWeather(...args),
}));

vi.mock('@integrations/conditions/persistence', () => ({
  loadLastKnownDriver: (...args: unknown[]) => mockLoadLastKnownDriver(...args),
  saveLastKnownDriver: (...args: unknown[]) => mockSaveLastKnownDriver(...args),
}));

function renderBar(initialEntry = '/') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DesignSystemV2Provider>
        <ConditionsBar />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockFetchLatestSpaceWeather.mockReset().mockReturnValue(new Promise(() => {})); // never resolves
  mockLoadLastKnownDriver.mockReset().mockReturnValue(null);
  mockSaveLastKnownDriver.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ConditionsBar', () => {
  it('shows preset provenance on first load with no network and no manual entry', async () => {
    renderBar();
    expect(await screen.findByText(/Preset/)).toBeInTheDocument();
    expect(screen.getByText(/SFI 120/)).toBeInTheDocument();
    expect(screen.getByText(/Kp 2/)).toBeInTheDocument();
  });

  it('reveals the time scrubber, manual driver fields and ground selector behind Edit', () => {
    renderBar();
    expect(screen.queryByLabelText('Solar Flux Index')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Edit conditions'));

    expect(screen.getByLabelText('Solar Flux Index')).toBeInTheDocument();
    expect(screen.getByLabelText('Kp index')).toBeInTheDocument();
    expect(screen.getByLabelText('Live now')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Ground type' })).toBeInTheDocument();
  });

  it('shows live provenance once a fetch succeeds', async () => {
    mockFetchLatestSpaceWeather.mockResolvedValue({ sfi: 150, kp: 4, observedAtMs: Date.now() });
    renderBar();
    await waitFor(() => {
      expect(screen.getByText(/SFI 150/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Live/)).toBeInTheDocument();
  });

  it('seeds a manual driver from the URL and shows manual provenance', () => {
    renderBar('/?dk=manual&sfi=200&kp=7');
    expect(screen.getByText(/SFI 200/)).toBeInTheDocument();
    expect(screen.getByText(/Kp 7/)).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
  });

  it('defaults liveNow to true and ground to land when the URL has no overrides', () => {
    renderBar();
    fireEvent.click(screen.getByText('Edit conditions'));
    expect(screen.getByLabelText('Live now')).toBeChecked();
  });

  it('defaults to the 40m band at its midpoint frequency, shown in the compact summary', () => {
    renderBar();
    expect(screen.getByText(/40 m @ 7.1 MHz/)).toBeInTheDocument();
  });

  it('reveals band chips and the frequency field behind Edit, and resets frequency on band change', () => {
    renderBar();
    fireEvent.click(screen.getByText('Edit conditions'));

    expect(screen.getByRole('group', { name: 'Band' })).toBeInTheDocument();
    const frequencyInput = screen.getByLabelText('Frequency (MHz)') as HTMLInputElement;
    expect(frequencyInput.value).toBe('7.1');

    const button20m = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.startsWith('20 m'));
    fireEvent.click(button20m!);

    expect(screen.getByText(/20 m @ 14.175 MHz/)).toBeInTheDocument();
    expect((screen.getByLabelText('Frequency (MHz)') as HTMLInputElement).value).toBe('14.175');
  });

  it('seeds the selected band from the URL b param', () => {
    renderBar('/?b=15m');
    expect(screen.getByText(/15 m @/)).toBeInTheDocument();
  });
});
