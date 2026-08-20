/**
 * Slice 4 (F6.4) integration check: resizing the component's container
 * recomputes and applies the viewport offset on the globe's underlying
 * camera — "holds across window resizes," per this phase's own AC. Pure
 * offset math is covered by `viewportOffset.test.ts`; this file only
 * checks the wiring (the same `ResizeObserver` signal that drives `size`
 * also drives the camera call).
 */
import { forwardRef, useImperativeHandle } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayerState } from '@core/domain/propagation/layers';

let resizeCallback: ResizeObserverCallback | null = null;
const setViewOffsetSpy = vi.fn();
const clearViewOffsetSpy = vi.fn();
const fakeCamera = { setViewOffset: setViewOffsetSpy, clearViewOffset: clearViewOffsetSpy };

class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock('react-globe.gl', () => ({
  default: forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    useImperativeHandle(ref, () => ({
      camera: () => fakeCamera,
      scene: () => ({ traverse: () => {} }),
      renderer: () => ({ localClippingEnabled: false }),
    }));
    return null;
  }),
}));

const { default: HfPropagationGlobe } = await import('./HfPropagationGlobe.tsx');

const LAYERS: LayerState[] = [
  { id: 'D', virtualHeightKm: 90, criticalFrequencyMhz: null },
  { id: 'E', virtualHeightKm: 110, criticalFrequencyMhz: 3 },
  { id: 'F1', virtualHeightKm: 200, criticalFrequencyMhz: 4 },
  { id: 'F2', virtualHeightKm: 300, criticalFrequencyMhz: 6 },
];

describe('HfPropagationGlobe viewport offset wiring', () => {
  let originalResizeObserver: typeof ResizeObserver;

  beforeEach(() => {
    originalResizeObserver = window.ResizeObserver;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.ResizeObserver = TestResizeObserver as any;
    resizeCallback = null;
    setViewOffsetSpy.mockClear();
    clearViewOffsetSpy.mockClear();
  });

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver;
  });

  it('applies a view offset on the camera once the container reports a desktop-width resize', () => {
    render(
      <HfPropagationGlobe
        layers={LAYERS}
        display={{ exaggerationFactor: 1, explodeEnabled: false, fresnelEnabled: false }}
        txLat={0}
        txLon={0}
        coverageResult={null}
      />,
    );
    expect(resizeCallback).not.toBeNull();

    act(() => {
      resizeCallback!(
        [{ contentRect: { width: 1200, height: 800 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(setViewOffsetSpy).toHaveBeenCalledWith(1200 + (340 / 2) * 2, 800, 0, 0, 1200, 800);
  });

  it('clears the offset once the container reports a mobile-width resize', () => {
    render(
      <HfPropagationGlobe
        layers={LAYERS}
        display={{ exaggerationFactor: 1, explodeEnabled: false, fresnelEnabled: false }}
        txLat={0}
        txLon={0}
        coverageResult={null}
      />,
    );

    act(() => {
      resizeCallback!(
        [{ contentRect: { width: 1200, height: 800 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
    expect(setViewOffsetSpy).toHaveBeenCalledTimes(1);

    act(() => {
      resizeCallback!(
        [{ contentRect: { width: 500, height: 800 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });
    expect(clearViewOffsetSpy).toHaveBeenCalled();
  });
});
