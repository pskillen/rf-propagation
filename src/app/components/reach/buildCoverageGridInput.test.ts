import { describe, expect, it } from 'vitest';
import { ssnFromSfi } from '@core/domain/propagation/losses';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import { buildCoverageGridInput, computeLayerStates } from './buildCoverageGridInput.ts';

describe('buildCoverageGridInput', () => {
  it('maps Station/Conditions fields onto CoverageGridInput unchanged', () => {
    const input = buildCoverageGridInput(DEFAULT_STATION, DEFAULT_CONDITIONS, 14.2);

    expect(input.txLat).toBe(DEFAULT_STATION.qth.lat);
    expect(input.txLon).toBe(DEFAULT_STATION.qth.lon);
    expect(input.atMs).toBe(DEFAULT_CONDITIONS.atMs);
    expect(input.frequencyMhz).toBe(14.2);
    expect(input.txPowerW).toBe(DEFAULT_STATION.powerW);
    expect(input.groundType).toBe(DEFAULT_CONDITIONS.ground);
    expect(input.noiseEnvironment).toBe(DEFAULT_STATION.noiseEnvironment);
    expect(input.bandwidthHz).toBe(2400);
    expect(input.ssn).toBeCloseTo(ssnFromSfi(DEFAULT_CONDITIONS.driver.sfi), 6);
  });

  it('passes the whole active antenna as txAntenna, and its flat gain as rxAntennaGainDbi (symmetric reference receiver)', () => {
    const input = buildCoverageGridInput(DEFAULT_STATION, DEFAULT_CONDITIONS, 14.2);
    const activeAntenna = DEFAULT_STATION.antennas.find(
      (a) => a.id === DEFAULT_STATION.activeAntennaId,
    )!;
    expect(input.txAntenna).toEqual(activeAntenna);
    expect(input.rxAntennaGainDbi).toBe(activeAntenna.gainDbi);
  });

  it('produces four layer states (D, E, F1, F2)', () => {
    const input = buildCoverageGridInput(DEFAULT_STATION, DEFAULT_CONDITIONS, 14.2);
    expect(input.layers.map((l) => l.id).sort()).toEqual(['D', 'E', 'F1', 'F2']);
  });

  it('an explicit qth override drives txLat/txLon instead of station.qth (live-drag path)', () => {
    const dragQth = { lat: 10, lon: 20 };
    const input = buildCoverageGridInput(DEFAULT_STATION, DEFAULT_CONDITIONS, 14.2, dragQth);
    expect(input.txLat).toBe(10);
    expect(input.txLon).toBe(20);
    // station.qth itself is untouched by the override.
    expect(DEFAULT_STATION.qth.lat).not.toBe(10);
  });
});

describe('computeLayerStates', () => {
  it("matches buildCoverageGridInput.layers exactly for the same station/conditions/qth (phase 9's globe reuses this, not a second computation)", () => {
    const input = buildCoverageGridInput(DEFAULT_STATION, DEFAULT_CONDITIONS, 14.2);
    const layers = computeLayerStates(DEFAULT_STATION.qth, DEFAULT_CONDITIONS);
    expect(layers).toEqual(input.layers);
  });

  it('produces four layer states (D, E, F1, F2)', () => {
    const layers = computeLayerStates(DEFAULT_STATION.qth, DEFAULT_CONDITIONS);
    expect(layers.map((l) => l.id).sort()).toEqual(['D', 'E', 'F1', 'F2']);
  });
});
