import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyViewportOffset,
  computeViewportOffsetPx,
  CONTROL_PANEL_WIDTH_PX,
  VIEWPORT_OFFSET_BREAKPOINT_PX,
} from './viewportOffset.ts';

describe('computeViewportOffsetPx', () => {
  it('is 0 below the mobile breakpoint (SurfaceLayout stacks the panel above the canvas there)', () => {
    expect(computeViewportOffsetPx(VIEWPORT_OFFSET_BREAKPOINT_PX - 1)).toBe(0);
    expect(computeViewportOffsetPx(360)).toBe(0); // the design docs' own hard mobile floor
  });

  it('is 0 for non-finite input', () => {
    expect(computeViewportOffsetPx(Number.NaN)).toBe(0);
    expect(computeViewportOffsetPx(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('shifts by half the control panel width at and above the breakpoint', () => {
    expect(computeViewportOffsetPx(VIEWPORT_OFFSET_BREAKPOINT_PX)).toBeCloseTo(
      CONTROL_PANEL_WIDTH_PX / 2,
      5,
    );
    expect(computeViewportOffsetPx(1400)).toBeCloseTo(CONTROL_PANEL_WIDTH_PX / 2, 5);
  });

  it('holds across a range of desktop widths without ever exceeding a third of the container', () => {
    for (const width of [768, 900, 1024, 1280, 1920]) {
      const offset = computeViewportOffsetPx(width);
      expect(offset).toBeLessThanOrEqual(width / 3);
    }
  });
});

describe('applyViewportOffset', () => {
  it('sets a view offset that shifts the optical centre right of the visible window centre', () => {
    const camera = new THREE.PerspectiveCamera();
    applyViewportOffset(camera, 1000, 800, 100);
    expect(camera.view?.enabled).toBe(true);
    expect(camera.view?.fullWidth).toBe(1200); // width + 2*shift
    expect(camera.view?.offsetX).toBe(0);
    expect(camera.view?.width).toBe(1000);
  });

  it('clears any previous offset when shiftPx is 0', () => {
    const camera = new THREE.PerspectiveCamera();
    applyViewportOffset(camera, 1000, 800, 100);
    expect(camera.view?.enabled).toBe(true);
    applyViewportOffset(camera, 1000, 800, 0);
    expect(camera.view?.enabled).toBe(false);
  });

  it('is a no-op for a zero-sized container', () => {
    const camera = new THREE.PerspectiveCamera();
    applyViewportOffset(camera, 0, 0, 100);
    expect(camera.view?.enabled ?? false).toBe(false);
  });
});
