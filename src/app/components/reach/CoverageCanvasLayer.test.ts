import L from 'leaflet';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import { CoverageCanvasLayer } from './CoverageCanvasLayer.ts';

const STATION = { latDeg: 52.4862, lonDeg: -1.8904 };

/** 2x2 grid, one skip-zone cell (255) among three populated cells. */
function fixtureResult(): CoverageGridResult {
  const azimuthCount = 2;
  const rangeBinCount = 2;
  const cellCount = azimuthCount * rangeBinCount;
  return {
    azimuthCount,
    rangeBinCount,
    rangeBinKm: 50,
    reliability: Float32Array.from([0.9, 0.5, 0.2, 0]),
    snrDb: new Float32Array(cellCount),
    hopCount: Uint8Array.from([0, 1, 255, 2]), // index 2 is the skip zone
  };
}

/** Minimal fake satisfying only the L.Map methods CoverageCanvasLayer actually calls. */
function fakeMap(): L.Map {
  const overlayPane = document.createElement('div');
  return {
    getPanes: () => ({ overlayPane }) as unknown as ReturnType<L.Map['getPanes']>,
    getSize: () => L.point(800, 600),
    containerPointToLayerPoint: () => L.point(0, 0),
    latLngToContainerPoint: (latlng: L.LatLngExpression) => {
      const { lat, lng } = L.latLng(latlng);
      // Deterministic but arbitrary mapping -- only needs to produce finite, distinct points.
      return L.point((lng + 180) * 2, (90 - lat) * 2);
    },
    on: () => undefined,
    off: () => undefined,
  } as unknown as L.Map;
}

describe('CoverageCanvasLayer', () => {
  let fillCalls: string[] = [];
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    fillCalls = [];
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
      let fillStyle = '';
      return {
        clearRect: () => undefined,
        beginPath: () => undefined,
        moveTo: () => undefined,
        lineTo: () => undefined,
        closePath: () => undefined,
        set fillStyle(value: string) {
          fillStyle = value;
        },
        get fillStyle() {
          return fillStyle;
        },
        globalAlpha: 1,
        fill: () => fillCalls.push(fillStyle),
      } as unknown as CanvasRenderingContext2D;
    });
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('attaches a canvas to the overlay pane and sizes it to the map once a result is set', () => {
    const layer = new CoverageCanvasLayer();
    const map = fakeMap();
    layer.onAdd(map);
    layer.setResult(fixtureResult(), STATION);

    const canvas = map.getPanes().overlayPane.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.width).toBe(800);
    expect(canvas?.height).toBe(600);
  });

  it('renders a fixture CoverageGridResult without throwing, filling only non-skip-zone cells', () => {
    const layer = new CoverageCanvasLayer();
    const map = fakeMap();
    layer.onAdd(map);

    expect(() => layer.setResult(fixtureResult(), STATION)).not.toThrow();

    // 3 of the 4 cells are populated (hopCount !== 255); the skip-zone cell draws nothing.
    expect(fillCalls).toHaveLength(3);
  });

  it('removing the layer detaches its canvas', () => {
    const layer = new CoverageCanvasLayer();
    const map = fakeMap();
    layer.onAdd(map);
    layer.onRemove(map);

    expect(map.getPanes().overlayPane.querySelector('canvas')).toBeNull();
  });

  it('does nothing (no throw) if setResult is called before onAdd', () => {
    const layer = new CoverageCanvasLayer();
    expect(() => layer.setResult(fixtureResult(), STATION)).not.toThrow();
  });
});
