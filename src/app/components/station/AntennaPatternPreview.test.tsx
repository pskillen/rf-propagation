import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { peakGainElevationDeg } from '@core/domain/antenna/antennaPattern';
import type { AntennaConfig } from '@core/domain/station/types';
import AntennaPatternPreview, {
  buildAzimuthCutPoints,
  buildElevationCutPoints,
} from './AntennaPatternPreview.tsx';

const REFERENCE_FREQUENCY_MHZ = 14;

function dipole(heightM: number): AntennaConfig {
  return {
    id: 'a',
    name: 'Test dipole',
    family: 'bidirectional-transverse',
    heightM,
    azimuthDeg: 0,
    gainDbi: 2.1,
  };
}

const BEAM: AntennaConfig = {
  id: 'beam',
  name: 'Test beam',
  family: 'directional-lobe',
  heightM: 10,
  azimuthDeg: 0,
  gainDbi: 10,
};

const OMNI: AntennaConfig = {
  id: 'omni',
  name: 'Test vertical',
  family: 'omnidirectional-vertical',
  heightM: 10,
  gainDbi: 3,
};

describe('AntennaPatternPreview', () => {
  it('renders three polar plots (two elevation cuts + one azimuth cut), each a distinct shape', () => {
    const { container } = render(<AntennaPatternPreview antenna={dipole(7)} />);
    const paths = Array.from(container.querySelectorAll('path')).map((path) =>
      path.getAttribute('d'),
    );

    expect(paths).toHaveLength(3);
    paths.forEach((d) => expect(d).toMatch(/^M /));

    const [parallel, perpendicular, azimuth] = paths;
    expect(parallel).not.toBe(perpendicular);
    expect(parallel).not.toBe(azimuth);
    expect(perpendicular).not.toBe(azimuth);
  });

  it('renders a visibly different pattern for a low vs a high dipole (NVIS vs DX)', () => {
    const low = render(<AntennaPatternPreview antenna={dipole(3)} />);
    const high = render(<AntennaPatternPreview antenna={dipole(15)} />);

    const lowParallelPath = low.container.querySelector('path')?.getAttribute('d');
    const highParallelPath = high.container.querySelector('path')?.getAttribute('d');

    expect(lowParallelPath).toBeTruthy();
    expect(highParallelPath).toBeTruthy();
    expect(lowParallelPath).not.toBe(highParallelPath);
  });

  it('each panel has a distinct, descriptive aria-label', () => {
    const { getAllByRole } = render(<AntennaPatternPreview antenna={dipole(7)} />);
    const labels = getAllByRole('img').map((el) => el.getAttribute('aria-label'));

    expect(labels.some((label) => /parallel cut/i.test(label ?? ''))).toBe(true);
    expect(labels.some((label) => /perpendicular cut/i.test(label ?? ''))).toBe(true);
    expect(labels.some((label) => /azimuth/i.test(label ?? ''))).toBe(true);
  });

  describe('Slice 4 -- pattern data (fix/reach-directionality-antenna-greyline)', () => {
    it('a directional-lobe beam has materially higher parallel-cut gain toward its boresight than directly behind it', () => {
      const points = buildElevationCutPoints(BEAM, 0, 180, REFERENCE_FREQUENCY_MHZ);
      const half = points.length / 2;
      const frontMaxDbi = Math.max(...points.slice(0, half).map((point) => point.gainDbi));
      const backMaxDbi = Math.max(...points.slice(half).map((point) => point.gainDbi));

      expect(frontMaxDbi).toBeGreaterThan(backMaxDbi + 10);
    });

    it('a directional-lobe beam has materially higher azimuth-cut gain toward its boresight than directly behind it', () => {
      const peakElevationDeg = peakGainElevationDeg(BEAM, 0, REFERENCE_FREQUENCY_MHZ);
      const points = buildAzimuthCutPoints(BEAM, peakElevationDeg, REFERENCE_FREQUENCY_MHZ);

      const forwardDbi = points.find((point) => point.angleDeg === 0)?.gainDbi;
      const backwardDbi = points.find((point) => point.angleDeg === 180)?.gainDbi;

      expect(forwardDbi).toBeDefined();
      expect(backwardDbi).toBeDefined();
      expect(forwardDbi!).toBeGreaterThan(backwardDbi! + 10);
    });

    it("an omnidirectional-vertical antenna's azimuth cut has (near-)constant gain across all bearings -- a circle", () => {
      const peakElevationDeg = peakGainElevationDeg(OMNI, 0, REFERENCE_FREQUENCY_MHZ);
      const points = buildAzimuthCutPoints(OMNI, peakElevationDeg, REFERENCE_FREQUENCY_MHZ);
      const gains = points.map((point) => point.gainDbi);

      expect(Math.max(...gains) - Math.min(...gains)).toBeLessThan(1e-6);
    });

    it("a bidirectional-transverse antenna's perpendicular cut is flatter (more nulled) than its parallel cut", () => {
      const antenna = dipole(7);
      const phi0 = antenna.azimuthDeg ?? 0;
      const parallel = buildElevationCutPoints(antenna, phi0, phi0 + 180, REFERENCE_FREQUENCY_MHZ);
      const perpendicular = buildElevationCutPoints(
        antenna,
        phi0 + 90,
        phi0 + 270,
        REFERENCE_FREQUENCY_MHZ,
      );

      const rangeOf = (points: { gainDbi: number }[]) =>
        Math.max(...points.map((p) => p.gainDbi)) - Math.min(...points.map((p) => p.gainDbi));

      const parallelRangeDb = rangeOf(parallel);
      const perpendicularRangeDb = rangeOf(perpendicular);

      // The perpendicular cut is where the dipole's azimuth term (cos of
      // the angle off boresight) goes to zero everywhere -- essentially
      // flat (floored), unlike the parallel cut's real elevation-driven
      // variation.
      expect(perpendicularRangeDb).toBeLessThan(1e-3);
      expect(parallelRangeDb).toBeGreaterThan(perpendicularRangeDb + 1);
    });
  });
});
