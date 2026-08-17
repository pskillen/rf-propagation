import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import type { QthLocation } from '@core/domain/station/types';
import QthPicker from './QthPicker.tsx';

const mockGeocodeQuery = vi.fn();
vi.mock('@integrations/geocode', async () => {
  const actual =
    await vi.importActual<typeof import('@integrations/geocode')>('@integrations/geocode');
  return {
    ...actual,
    geocodeQuery: (...args: unknown[]) => mockGeocodeQuery(...args),
  };
});

vi.mock('./QthMap.tsx', () => ({
  default: ({ onChange }: { onChange: (lat: number, lon: number) => void }) => (
    <button type="button" onClick={() => onChange(48.8566, 2.3522)}>
      simulate map drag
    </button>
  ),
}));

const INITIAL_QTH: QthLocation = {
  lat: 52.4862,
  lon: -1.8904,
  locator: 'IO92aq',
  source: 'default',
};

function renderPicker(onStationChange = vi.fn()) {
  render(
    <DesignSystemV2Provider>
      <QthPicker qth={INITIAL_QTH} onStationChange={onStationChange} />
    </DesignSystemV2Provider>,
  );
  return onStationChange;
}

beforeEach(() => {
  localStorage.clear();
  mockGeocodeQuery.mockReset();
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition: vi.fn() },
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QthPicker', () => {
  it('geolocation updates lat/lon/locator/source', async () => {
    const geolocation = navigator.geolocation as unknown as {
      getCurrentPosition: ReturnType<typeof vi.fn>;
    };
    geolocation.getCurrentPosition.mockImplementation(
      (success: (position: GeolocationPosition) => void) => {
        success({
          coords: { latitude: 51.5, longitude: -0.1, accuracy: 10 },
        } as GeolocationPosition);
      },
    );

    const onStationChange = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }));

    await waitFor(() => expect(onStationChange).toHaveBeenCalled());
    const station = onStationChange.mock.calls[0][0];
    expect(station.qth.lat).toBe(51.5);
    expect(station.qth.lon).toBe(-0.1);
    expect(station.qth.source).toBe('geolocation');
    expect(station.qth.locator).toBeTruthy();
  });

  it('geolocation denial does not disable the other three QTH routes', async () => {
    const geolocation = navigator.geolocation as unknown as {
      getCurrentPosition: ReturnType<typeof vi.fn>;
    };
    geolocation.getCurrentPosition.mockImplementation(
      (
        _success: (position: GeolocationPosition) => void,
        error: (err: GeolocationPositionError) => void,
      ) => {
        error({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError);
      },
    );

    renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /use my location/i }));

    await waitFor(() => {
      expect(screen.getByText(/location permission denied/i)).toBeInTheDocument();
    });

    // The other three routes remain interactive after a geolocation error.
    expect(screen.getByLabelText('Maidenhead locator')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Set' })).toBeEnabled();
    expect(screen.getByRole('textbox', { name: /search an address or place/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /simulate map drag/i })).toBeEnabled();
  });

  it('a valid Maidenhead locator updates lat/lon/locator/source', () => {
    const onStationChange = renderPicker();
    fireEvent.change(screen.getByLabelText('Maidenhead locator'), {
      target: { value: 'JO01gr' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));

    expect(onStationChange).toHaveBeenCalled();
    const station = onStationChange.mock.calls[0][0];
    expect(station.qth.source).toBe('maidenhead');
    expect(station.qth.locator).toBe('JO01GR');
    expect(station.qth.lat).toBeCloseTo(51.7, 0);
    expect(station.qth.lon).toBeCloseTo(0.6, 0);
  });

  it('rejects an invalid Maidenhead locator without calling onStationChange', () => {
    const onStationChange = renderPicker();
    fireEvent.change(screen.getByLabelText('Maidenhead locator'), {
      target: { value: 'nope' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Set' }));

    expect(onStationChange).not.toHaveBeenCalled();
    expect(screen.getByText(/enter a valid 4 or 6-character/i)).toBeInTheDocument();
  });

  it('selecting an address search result updates lat/lon/locator/source/label', async () => {
    mockGeocodeQuery.mockResolvedValue({ lat: 40.7128, lon: -74.006, label: 'New York, USA' });

    const onStationChange = renderPicker();
    const addressInput = screen.getByRole('textbox', { name: /search an address or place/i });
    fireEvent.focus(addressInput);
    fireEvent.change(addressInput, {
      target: { value: 'New York' },
    });

    await waitFor(() => expect(mockGeocodeQuery).toHaveBeenCalledWith('New York'), {
      timeout: 1000,
    });

    const option = await screen.findByText('New York, USA');
    fireEvent.click(option);

    expect(onStationChange).toHaveBeenCalled();
    const station = onStationChange.mock.calls[0][0];
    expect(station.qth.source).toBe('address');
    expect(station.qth.lat).toBe(40.7128);
    expect(station.qth.lon).toBe(-74.006);
    expect(station.qth.label).toBe('New York, USA');
  });

  it('dragging the map pin updates lat/lon/locator/source', () => {
    const onStationChange = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /simulate map drag/i }));

    expect(onStationChange).toHaveBeenCalled();
    const station = onStationChange.mock.calls[0][0];
    expect(station.qth.source).toBe('map');
    expect(station.qth.lat).toBe(48.8566);
    expect(station.qth.lon).toBe(2.3522);
  });
});
