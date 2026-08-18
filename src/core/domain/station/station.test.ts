import { describe, expect, it } from 'vitest';
import { DEFAULT_STATION } from './defaults';
import { isValidStation, type Station } from './types';

function validStation(): Station {
  return {
    qth: { lat: 51.5, lon: -0.1, locator: 'IO91wm', source: 'map' },
    antennas: [
      { id: 'a1', name: 'Dipole', family: 'bidirectional-transverse', heightM: 10, gainDbi: 2 },
      { id: 'a2', name: 'Vertical', family: 'omnidirectional-vertical', heightM: 3, gainDbi: 0 },
    ],
    activeAntennaId: 'a1',
    powerW: 50,
    noiseEnvironment: 'urban',
  };
}

describe('isValidStation', () => {
  it('accepts a well-formed station', () => {
    expect(isValidStation(validStation())).toBe(true);
  });

  it('accepts the default station', () => {
    expect(isValidStation(DEFAULT_STATION)).toBe(true);
  });

  it.each([null, undefined, 42, 'not-a-station', []])('rejects non-object value %p', (value) => {
    expect(isValidStation(value)).toBe(false);
  });

  it('rejects a missing qth', () => {
    const station = validStation() as unknown as Record<string, unknown>;
    delete station.qth;
    expect(isValidStation(station)).toBe(false);
  });

  it('rejects an empty antennas array', () => {
    const station = { ...validStation(), antennas: [] };
    expect(isValidStation(station)).toBe(false);
  });

  it('rejects an activeAntennaId not present in antennas', () => {
    const station = { ...validStation(), activeAntennaId: 'does-not-exist' };
    expect(isValidStation(station)).toBe(false);
  });

  it('rejects an antenna with an unknown pattern family', () => {
    const station = validStation();
    station.antennas = [{ ...station.antennas[0], family: 'bogus' } as never];
    expect(isValidStation(station)).toBe(false);
  });

  it('rejects a non-finite powerW', () => {
    const station = { ...validStation(), powerW: Number.NaN };
    expect(isValidStation(station)).toBe(false);
  });

  it('rejects a zero or negative powerW', () => {
    expect(isValidStation({ ...validStation(), powerW: 0 })).toBe(false);
    expect(isValidStation({ ...validStation(), powerW: -5 })).toBe(false);
  });

  it('rejects an unknown noiseEnvironment literal', () => {
    const station = { ...validStation(), noiseEnvironment: 'suburban' };
    expect(isValidStation(station)).toBe(false);
  });

  it('rejects a qth with an out-of-range or non-finite lat/lon', () => {
    const station = validStation();
    station.qth = { ...station.qth, lat: Number.NaN };
    expect(isValidStation(station)).toBe(false);
  });
});
