/**
 * `react-globe.gl` needs a WebGL context jsdom doesn't provide, so this
 * mocks it to a stub component and asserts the props (`customLayerData`,
 * `pathsData`, `pointsData`) it receives — the same testing convention
 * the reference component's own sidecar doc documents (see
 * `HfPropagationGlobe.md`). Mesh/shader/texture math itself is covered by
 * `buildGlobeData.test.ts`.
 */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import type { LayerState } from '@core/domain/propagation/layers';

interface CapturedProps {
  customLayerData: unknown[];
  pathsData: unknown[];
  pointsData: unknown[];
}

let captured: CapturedProps | null = null;

vi.mock('react-globe.gl', () => ({
  default: (props: CapturedProps) => {
    captured = props;
    return null;
  },
}));

const { default: HfPropagationGlobe } = await import('./HfPropagationGlobe.tsx');

const LAYERS: LayerState[] = [
  { id: 'D', virtualHeightKm: 90, criticalFrequencyMhz: null },
  { id: 'E', virtualHeightKm: 110, criticalFrequencyMhz: 3 },
  { id: 'F1', virtualHeightKm: 200, criticalFrequencyMhz: null }, // night
  { id: 'F2', virtualHeightKm: 300, criticalFrequencyMhz: 6 },
];

const DISPLAY = { exaggerationFactor: 1, explodeEnabled: false, fresnelEnabled: false };

function fixtureResult(): CoverageGridResult {
  const azimuthCount = 2;
  const rangeBinCount = 2;
  return {
    azimuthCount,
    rangeBinCount,
    rangeBinKm: 50,
    reliability: new Float32Array(azimuthCount * rangeBinCount).fill(0.5),
    snrDb: new Float32Array(azimuthCount * rangeBinCount),
    hopCount: new Uint8Array(azimuthCount * rangeBinCount).fill(0),
  };
}

describe('HfPropagationGlobe', () => {
  it('always renders all four shells, even one with criticalFrequencyMhz: null (D always, F1 at night)', () => {
    render(
      <HfPropagationGlobe
        layers={LAYERS}
        display={DISPLAY}
        txLat={0}
        txLon={0}
        coverageResult={null}
      />,
    );
    const shellIds = captured!.customLayerData
      .filter((d): d is LayerState => typeof (d as LayerState).id === 'string')
      .map((d) => d.id);
    expect(shellIds).toEqual(['D', 'E', 'F1', 'F2']);
  });

  it('without environmentAtMs: no night-shade or sun-marker layer, no terminator path', () => {
    render(
      <HfPropagationGlobe
        layers={LAYERS}
        display={DISPLAY}
        txLat={0}
        txLon={0}
        coverageResult={null}
      />,
    );
    const kinds = captured!.customLayerData.map((d) => (d as { kind?: string }).kind);
    expect(kinds).not.toContain('night-shade');
    expect(kinds).not.toContain('sun');
    expect(captured!.pathsData).toHaveLength(0);
  });

  it('with environmentAtMs: adds night-shade always; sun marker + terminator path only when terminatorEnabled', () => {
    const atMs = Date.UTC(2024, 2, 20, 12, 0, 0);
    render(
      <HfPropagationGlobe
        layers={LAYERS}
        display={DISPLAY}
        environmentAtMs={atMs}
        txLat={0}
        txLon={0}
        coverageResult={null}
      />,
    );
    let kinds = captured!.customLayerData.map((d) => (d as { kind?: string }).kind);
    expect(kinds).toContain('night-shade');
    expect(kinds).not.toContain('sun');
    expect(captured!.pathsData).toHaveLength(0);

    render(
      <HfPropagationGlobe
        layers={LAYERS}
        display={DISPLAY}
        environmentAtMs={atMs}
        terminatorEnabled
        txLat={0}
        txLon={0}
        coverageResult={null}
      />,
    );
    kinds = captured!.customLayerData.map((d) => (d as { kind?: string }).kind);
    expect(kinds).toContain('night-shade');
    expect(kinds).toContain('sun');
    expect(captured!.pathsData.length).toBeGreaterThan(0);
  });

  it('adds one coverage-ground custom-layer entry only when a coverageResult is present', () => {
    render(
      <HfPropagationGlobe
        layers={LAYERS}
        display={DISPLAY}
        txLat={0}
        txLon={0}
        coverageResult={null}
      />,
    );
    let groundEntries = captured!.customLayerData.filter(
      (d) => (d as { kind?: string }).kind === 'coverage-ground',
    );
    expect(groundEntries).toHaveLength(0);

    render(
      <HfPropagationGlobe
        layers={LAYERS}
        display={DISPLAY}
        txLat={51.5}
        txLon={-0.13}
        coverageResult={fixtureResult()}
      />,
    );
    groundEntries = captured!.customLayerData.filter(
      (d) => (d as { kind?: string }).kind === 'coverage-ground',
    );
    expect(groundEntries).toHaveLength(1);
  });

  it('always adds exactly one transmitter point at txLat/txLon', () => {
    render(
      <HfPropagationGlobe
        layers={LAYERS}
        display={DISPLAY}
        txLat={51.5}
        txLon={-0.13}
        coverageResult={null}
      />,
    );
    expect(captured!.pointsData).toEqual([
      expect.objectContaining({ kind: 'transmitter', lat: 51.5, lng: -0.13 }),
    ]);
  });

  it('cutaway does not add extra custom-layer entries (it clips existing shell materials, not a new object)', () => {
    render(
      <HfPropagationGlobe
        layers={LAYERS}
        display={DISPLAY}
        txLat={0}
        txLon={0}
        coverageResult={null}
      />,
    );
    const withoutCutawayCount = captured!.customLayerData.length;

    render(
      <HfPropagationGlobe
        layers={LAYERS}
        display={DISPLAY}
        txLat={0}
        txLon={0}
        coverageResult={null}
        cutawayEnabled
        sliceBearingDeg={45}
      />,
    );
    expect(captured!.customLayerData).toHaveLength(withoutCutawayCount);
  });
});
