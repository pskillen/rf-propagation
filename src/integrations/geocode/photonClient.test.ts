import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeocodeError } from './types';
import { fetchPhotonGeocode, fetchPhotonReverseGeocode } from './photonClient';

function mockFetchOnce(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      status,
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPhotonGeocode', () => {
  it('hits the documented Photon endpoint and parses the first feature', async () => {
    mockFetchOnce(200, {
      features: [
        {
          geometry: { coordinates: [-1.8904, 52.4862] },
          properties: { name: 'Birmingham', city: 'Birmingham', country: 'United Kingdom' },
        },
      ],
    });

    const result = await fetchPhotonGeocode('Birmingham');

    expect(fetch).toHaveBeenCalledWith('https://photon.komoot.io/api/?q=Birmingham&limit=1');
    expect(result).toEqual({
      lat: 52.4862,
      lon: -1.8904,
      label: 'Birmingham, Birmingham, United Kingdom',
    });
  });

  it('returns null when there are no features', async () => {
    mockFetchOnce(200, { features: [] });
    expect(await fetchPhotonGeocode('nowhere')).toBeNull();
  });

  it('throws GeocodeError on a non-2xx response', async () => {
    mockFetchOnce(429, {});
    await expect(fetchPhotonGeocode('too many')).rejects.toBeInstanceOf(GeocodeError);
  });

  it('throws GeocodeError when the network request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchPhotonGeocode('offline')).rejects.toBeInstanceOf(GeocodeError);
  });
});

describe('fetchPhotonReverseGeocode', () => {
  it('hits the documented Photon reverse endpoint and parses the first feature', async () => {
    mockFetchOnce(200, {
      features: [
        {
          geometry: { coordinates: [-1.8904, 52.4862] },
          properties: { name: 'Birmingham', country: 'United Kingdom', state: 'England' },
        },
      ],
    });

    const result = await fetchPhotonReverseGeocode(52.4862, -1.8904);

    expect(fetch).toHaveBeenCalledWith(
      'https://photon.komoot.io/reverse?lat=52.4862&lon=-1.8904&limit=1',
    );
    expect(result).toEqual({
      lat: 52.4862,
      lon: -1.8904,
      country: 'United Kingdom',
      label: 'Birmingham, England, United Kingdom',
    });
  });

  it('returns null when there are no features', async () => {
    mockFetchOnce(200, { features: [] });
    expect(await fetchPhotonReverseGeocode(0, 0)).toBeNull();
  });
});
