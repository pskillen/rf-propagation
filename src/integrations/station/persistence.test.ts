import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import type { Station } from '@core/domain/station/types';
import { loadStation, mergeStation, saveStation } from './persistence';

const STATION_STORAGE_KEY = 'rf-propagation.station.v1';

function otherStation(): Station {
  return {
    qth: { lat: 40, lon: -74, locator: 'FN30as', source: 'geolocation' },
    antennas: [
      { id: 'v1', name: 'Vertical', family: 'omnidirectional-vertical', heightM: 5, gainDbi: 0 },
    ],
    activeAntennaId: 'v1',
    powerW: 25,
    noiseEnvironment: 'quietRural',
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('loadStation / saveStation', () => {
  it('returns null when nothing is stored', () => {
    expect(loadStation()).toBeNull();
  });

  it('round-trips a valid station through save and load', () => {
    const station = otherStation();
    saveStation(station);
    expect(loadStation()).toEqual(station);
  });

  it('returns null (not throw) for truncated/invalid JSON in storage', () => {
    localStorage.setItem(STATION_STORAGE_KEY, '{not valid json');
    expect(() => loadStation()).not.toThrow();
    expect(loadStation()).toBeNull();
  });

  it('returns null for well-formed JSON that is not a valid Station (outdated schema)', () => {
    localStorage.setItem(STATION_STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    expect(loadStation()).toBeNull();
  });

  it('returns null when activeAntennaId no longer matches any antenna', () => {
    const station = otherStation();
    localStorage.setItem(
      STATION_STORAGE_KEY,
      JSON.stringify({ ...station, activeAntennaId: 'missing' }),
    );
    expect(loadStation()).toBeNull();
  });
});

describe('mergeStation', () => {
  it('merges onto DEFAULT_STATION when nothing is stored yet', () => {
    const result = mergeStation({ powerW: 400 });
    expect(result).toEqual({ ...DEFAULT_STATION, powerW: 400 });
    expect(loadStation()).toEqual(result);
  });

  it('merges onto the currently-stored station', () => {
    saveStation(otherStation());
    const result = mergeStation({ powerW: 75 });
    expect(result).toEqual({ ...otherStation(), powerW: 75 });
  });

  it('persists the merged result', () => {
    mergeStation({ noiseEnvironment: 'urban' });
    expect(loadStation()?.noiseEnvironment).toBe('urban');
  });
});
