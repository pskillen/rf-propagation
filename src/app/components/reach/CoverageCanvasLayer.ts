/**
 * Custom Leaflet layer that draws the coverage grid onto a single
 * `<canvas>` positioned over the map pane (F5.2) — the 2D-map equivalent
 * of "one BufferGeometry updated in place." `CoverageGridResult` has up to
 * 72 x rangeBinCount cells; rendering each as a Leaflet `Polygon` (one DOM/
 * SVG element per cell) is exactly the "thousands of scene objects" F5.2's
 * acceptance criterion rules out.
 *
 * Redrawn in place on every new grid result (`setResult`) and on map move/
 * zoom/resize. NOT a react-leaflet declarative component — plain
 * `L.Layer` subclass, instantiated imperatively by `ReachMap` via
 * `useMap()` + `useEffect`, matching how a custom canvas overlay is
 * normally wired into react-leaflet (there's no first-class declarative
 * wrapper for an arbitrary canvas layer).
 */
import L from 'leaflet';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import type { GeoPoint } from '@core/domain/propagation/greatCircle';
import { unwrapLongitudeRelativeTo } from '../../lib/geo/unwrapLongitude.ts';
import { cellFillStyle } from './cellFillStyle.ts';
import { cellCorners, type CellGridShape } from './coverageCellProjection.ts';

/** Cross-fade duration when a fine pass replaces a coarse one — "visibly but not jarringly" (Slice 2's own wording), not a hard swap. */
const FINE_PASS_FADE_MS = 180;

export type CoveragePass = 'coarse' | 'fine';

export class CoverageCanvasLayer extends L.Layer {
  private canvas: HTMLCanvasElement | null = null;
  private map: L.Map | null = null;
  private result: CoverageGridResult | null = null;
  private station: GeoPoint | null = null;
  private lastPass: CoveragePass | null = null;

  private readonly onMapChange = (): void => this.redraw();

  /**
   * Sets (or replaces) the grid being drawn and redraws immediately —
   * called for every coarse/fine response. Only a coarse -> fine
   * transition (not coarse -> coarse, which happens repeatedly during a
   * live drag and must stay instantaneous) gets the brief cross-fade —
   * see this module's own doc comment.
   */
  setResult(result: CoverageGridResult, station: GeoPoint, pass: CoveragePass = 'fine'): void {
    this.result = result;
    this.station = station;
    this.redraw();

    if (this.canvas) {
      if (pass === 'fine' && this.lastPass === 'coarse') {
        this.canvas.style.transition = `opacity ${FINE_PASS_FADE_MS}ms ease-out`;
        this.canvas.style.opacity = '0.6';
        const canvas = this.canvas;
        requestAnimationFrame(() => {
          canvas.style.opacity = '1';
        });
      } else {
        this.canvas.style.transition = '';
        this.canvas.style.opacity = '1';
      }
    }
    this.lastPass = pass;
  }

  onAdd(map: L.Map): this {
    this.map = map;
    const canvas = L.DomUtil.create('canvas', 'reach-coverage-canvas') as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none'; // never intercepts the map's own click/drag handling (Slice 5's map-click target still fires)
    this.canvas = canvas;
    map.getPanes().overlayPane.appendChild(canvas);
    map.on('move zoom resize', this.onMapChange);
    this.redraw();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off('move zoom resize', this.onMapChange);
    this.canvas?.remove();
    this.canvas = null;
    this.map = null;
    this.lastPass = null;
    return this;
  }

  private redraw(): void {
    const { map, canvas, result, station } = this;
    if (!map || !canvas || !result || !station) return;

    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const shape: CellGridShape = {
      azimuthCount: result.azimuthCount,
      rangeBinCount: result.rangeBinCount,
      rangeBinKm: result.rangeBinKm,
    };

    for (let az = 0; az < result.azimuthCount; az++) {
      for (let bin = 0; bin < result.rangeBinCount; bin++) {
        const idx = az * result.rangeBinCount + bin;
        const style = cellFillStyle(result.hopCount[idx], result.reliability[idx]);
        if (!style) continue; // skip zone / no coverage — deliberately no fill, see cellFillStyle.ts

        const corners = cellCorners(station, shape, az, bin);
        // Each corner's longitude was normalised to (-180, 180] independently
        // by destinationPoint, so a cell straddling the antimeridian can have
        // corners on opposite sides of that seam even though they're metres
        // apart on the ground -- unwrap each corner relative to the previous
        // one (chained through the quad) so the polygon stays continuous in
        // screen space instead of stretching across the whole map. See
        // unwrapLongitude.ts's doc comment.
        let referenceLonDeg = corners[0].lonDeg;
        const points = corners.map((corner) => {
          const lonDeg = unwrapLongitudeRelativeTo(corner.lonDeg, referenceLonDeg);
          referenceLonDeg = lonDeg;
          return map.latLngToContainerPoint([corner.latDeg, lonDeg]);
        });

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.closePath();
        ctx.globalAlpha = style.opacity;
        ctx.fillStyle = style.color;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
