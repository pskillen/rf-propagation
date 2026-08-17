import { describe, expect, it } from 'vitest';
import {
  antennaGain,
  elevationGainDbi,
  groundReflectionFactor,
  peakGainElevationDeg,
  wavelengthM,
} from './antennaPattern';
import type { AntennaConfig } from '../station/types';

const HF_FREQUENCY_MHZ = 14.2;

function antenna(
  overrides: Partial<AntennaConfig> & Pick<AntennaConfig, 'family' | 'heightM'>,
): AntennaConfig {
  return { id: 'test', name: 'Test antenna', gainDbi: 3, ...overrides };
}

describe('wavelengthM', () => {
  it('returns ~21.1 m at 14.2 MHz', () => {
    expect(wavelengthM(HF_FREQUENCY_MHZ)).toBeCloseTo(21.112, 3);
  });
});

describe('antennaGain', () => {
  describe('omnidirectional-vertical', () => {
    const ant = antenna({ family: 'omnidirectional-vertical', heightM: 8 });

    it('has an overhead null at theta=90°', () => {
      expect(antennaGain(ant, 90, 0, HF_FREQUENCY_MHZ)).toBeCloseTo(0, 10);
    });

    it('is azimuth-independent for a fixed elevation', () => {
      const at0 = antennaGain(ant, 30, 0, HF_FREQUENCY_MHZ);
      const at90 = antennaGain(ant, 30, 90, HF_FREQUENCY_MHZ);
      const at180 = antennaGain(ant, 30, 180, HF_FREQUENCY_MHZ);
      expect(at90).toBeCloseTo(at0, 10);
      expect(at180).toBeCloseTo(at0, 10);
    });
  });

  describe('bidirectional-transverse', () => {
    const ant = antenna({ family: 'bidirectional-transverse', heightM: 8, azimuthDeg: 0 });

    it('has figure-8 azimuth nulls at phi0 ± 90°', () => {
      expect(antennaGain(ant, 30, 90, HF_FREQUENCY_MHZ)).toBeCloseTo(0, 10);
      expect(antennaGain(ant, 30, -90, HF_FREQUENCY_MHZ)).toBeCloseTo(0, 10);
      expect(antennaGain(ant, 30, 0, HF_FREQUENCY_MHZ)).toBeGreaterThan(0);
    });

    it('peaks at theta=90° for low h/λ (NVIS, 0.1) and near 30° for h/λ=0.5', () => {
      const lambdaM = wavelengthM(HF_FREQUENCY_MHZ);
      const low = 0.1 * lambdaM;
      const standard = 0.5 * lambdaM;

      const lowAt90 = Math.abs(groundReflectionFactor(90, low, lambdaM));
      const lowAt30 = Math.abs(groundReflectionFactor(30, low, lambdaM));
      expect(lowAt90).toBeGreaterThan(lowAt30);

      const stdAt90 = Math.abs(groundReflectionFactor(90, standard, lambdaM));
      const stdAt30 = Math.abs(groundReflectionFactor(30, standard, lambdaM));
      expect(stdAt90).toBeCloseTo(0, 10);
      expect(stdAt30).toBeGreaterThan(stdAt90);

      const nvis = antenna({ family: 'bidirectional-transverse', heightM: low, azimuthDeg: 0 });
      expect(peakGainElevationDeg(nvis, 0, HF_FREQUENCY_MHZ)).toBe(90);

      const dx = antenna({
        family: 'bidirectional-transverse',
        heightM: standard,
        azimuthDeg: 0,
      });
      expect(peakGainElevationDeg(dx, 0, HF_FREQUENCY_MHZ)).toBe(30);
    });
  });

  describe('directional-lobe', () => {
    const ant = antenna({ family: 'directional-lobe', heightM: 8, azimuthDeg: 45 });

    it('peaks at the heading azimuth and falls off symmetrically', () => {
      const onAxis = antennaGain(ant, 20, 45, HF_FREQUENCY_MHZ);
      const left = antennaGain(ant, 20, 25, HF_FREQUENCY_MHZ);
      const right = antennaGain(ant, 20, 65, HF_FREQUENCY_MHZ);
      expect(onAxis).toBeGreaterThan(left);
      expect(onAxis).toBeGreaterThan(right);
      expect(left).toBeCloseTo(right, 10);
    });
  });

  describe('multi-lobe-conical', () => {
    const ant = antenna({ family: 'multi-lobe-conical', heightM: 8, wireLengthWavelengths: 2 });

    it('does not produce NaN at the poles', () => {
      expect(antennaGain(ant, 0, 0, HF_FREQUENCY_MHZ)).toBe(0);
      expect(antennaGain(ant, 180, 0, HF_FREQUENCY_MHZ)).toBe(0);
      expect(Number.isFinite(antennaGain(ant, 0, 0, HF_FREQUENCY_MHZ))).toBe(true);
      expect(Number.isFinite(antennaGain(ant, 180, 0, HF_FREQUENCY_MHZ))).toBe(true);
    });
  });
});

describe('elevationGainDbi', () => {
  it('equals gainDbi at the antenna own peak elevation angle (normalisation property)', () => {
    const ant = antenna({
      family: 'bidirectional-transverse',
      heightM: 10,
      azimuthDeg: 0,
      gainDbi: 5.5,
    });
    const peakElevation = peakGainElevationDeg(ant, 0, HF_FREQUENCY_MHZ);
    expect(elevationGainDbi(ant, peakElevation, 0, HF_FREQUENCY_MHZ)).toBeCloseTo(5.5, 6);
  });

  it('holds the normalisation property for every pattern family', () => {
    const families: AntennaConfig[] = [
      antenna({ family: 'omnidirectional-vertical', heightM: 8, gainDbi: 0 }),
      antenna({ family: 'bidirectional-transverse', heightM: 8, azimuthDeg: 0, gainDbi: 2.1 }),
      antenna({ family: 'directional-lobe', heightM: 8, azimuthDeg: 45, gainDbi: 9 }),
      antenna({
        family: 'multi-lobe-conical',
        heightM: 8,
        wireLengthWavelengths: 2,
        gainDbi: 4,
      }),
    ];

    for (const ant of families) {
      const phi0 = ant.azimuthDeg ?? 0;
      const peakElevation = peakGainElevationDeg(ant, phi0, HF_FREQUENCY_MHZ);
      expect(elevationGainDbi(ant, peakElevation, phi0, HF_FREQUENCY_MHZ)).toBeCloseTo(
        ant.gainDbi,
        6,
      );
    }
  });

  it('raising heightM shifts a dipole peak elevation toward lower angles (NVIS vs DX)', () => {
    const lowHeight = antenna({
      family: 'bidirectional-transverse',
      heightM: 3,
      azimuthDeg: 0,
      gainDbi: 2,
    });
    const highHeight = antenna({
      family: 'bidirectional-transverse',
      heightM: 15,
      azimuthDeg: 0,
      gainDbi: 2,
    });

    const lowPeak = peakGainElevationDeg(lowHeight, 0, HF_FREQUENCY_MHZ);
    const highPeak = peakGainElevationDeg(highHeight, 0, HF_FREQUENCY_MHZ);

    expect(lowPeak).not.toBe(highPeak);
    expect(highPeak).toBeLessThan(lowPeak);
  });

  it('does not return -Infinity or NaN at a pattern null', () => {
    const ant = antenna({ family: 'bidirectional-transverse', heightM: 8, azimuthDeg: 0 });
    // 30° elevation, 90° off-axis azimuth is a figure-8 null (see antennaGain tests above).
    const value = elevationGainDbi(ant, 30, 90, HF_FREQUENCY_MHZ);
    expect(Number.isFinite(value)).toBe(true);
  });
});
