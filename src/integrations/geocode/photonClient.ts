// Adapted from Codeplug Studio's src/integrations/geocode/photonClient.ts.
// Deliberate simplification, flagged: Studio's photonClient.ts routes
// requests through a shared fetchCachedText helper
// (@integrations/http/cachedFetch.ts/sessionCache.ts) for response caching
// and rate-limit handling. That shared caching layer pulls in
// infrastructure this app doesn't otherwise need, so this uses a plain
// fetch with the same URL shape, response parsing and error messages
// instead. Response parsing (parsePhotonGeocodeBody/parsePhotonReverseBody)
// is otherwise ported verbatim.

import type { GeocodeResult, ReverseGeocodeResult } from './types';
import { GeocodeError } from './types';

const PHOTON_NETWORK_ERROR = 'Could not reach Photon geocoding — check your network connection.';

export function parsePhotonGeocodeBody(body: string, fallbackLabel: string): GeocodeResult | null {
  const data = JSON.parse(body) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: { name?: string; city?: string; country?: string };
    }[];
  };
  const feature = data.features?.[0];
  if (!feature) return null;

  const [lon, lat] = feature.geometry.coordinates;
  const { name, city, country } = feature.properties;
  const label = [name, city, country].filter(Boolean).join(', ') || fallbackLabel;
  return { lat, lon, label };
}

export function parsePhotonReverseBody(
  body: string,
  lat: number,
  lon: number,
): ReverseGeocodeResult | null {
  const data = JSON.parse(body) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: { name?: string; city?: string; country?: string; state?: string };
    }[];
  };
  const feature = data.features?.[0];
  if (!feature) return null;

  const [featureLon, featureLat] = feature.geometry.coordinates;
  const { name, city, country, state } = feature.properties;
  const label = [name, city, state, country].filter(Boolean).join(', ') || `${lat}, ${lon}`;
  return {
    lat: featureLat,
    lon: featureLon,
    country: country?.trim() || null,
    label,
  };
}

async function fetchPhotonText(url: string): Promise<{ body: string; status: number }> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new GeocodeError(PHOTON_NETWORK_ERROR);
  }
  return { body: await response.text(), status: response.status };
}

export async function fetchPhotonGeocode(query: string): Promise<GeocodeResult | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
  const { body, status } = await fetchPhotonText(url);
  if (status < 200 || status >= 300) {
    throw new GeocodeError(`Photon geocoding failed (${status})`);
  }
  return parsePhotonGeocodeBody(body, query);
}

export async function fetchPhotonReverseGeocode(
  lat: number,
  lon: number,
): Promise<ReverseGeocodeResult | null> {
  const url = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&limit=1`;
  const { body, status } = await fetchPhotonText(url);
  if (status < 200 || status >= 300) {
    throw new GeocodeError(`Photon reverse geocoding failed (${status})`);
  }
  return parsePhotonReverseBody(body, lat, lon);
}
