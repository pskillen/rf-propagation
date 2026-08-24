// Reach's 2D map surface (F5.1) — Leaflet scaffolding shape adapted from
// Codeplug Studio's PropagationTopDownMap.tsx (MapContainer + TileLayer +
// a divIcon transmitter marker + a MapResizeFix component), and the
// draggable-marker pattern from Studio's MapLocationPicker.tsx / this
// repo's own QthMap.tsx (click-to-place/drag-to-adjust) — EXCEPT
// MapLocationPicker (and QthMap) only wire Leaflet's `dragend` event,
// which is exactly the mk1-shaped anti-pattern this phase must not
// repeat: `drag` fires continuously while the pointer moves, and Reach
// needs that to animate the coverage surface live (FR-27/FR-28), not just
// react on release.
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, type Ref } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Station } from '@core/domain/station/types';
import type { CoverageGridResult } from '@core/domain/propagation/coverageGrid';
import { CoverageCanvasLayer, type CoveragePass } from './CoverageCanvasLayer.ts';
import TerminatorLayer from './TerminatorLayer.tsx';
import classes from './ReachMap.module.css';

const DEFAULT_ZOOM = 5;

// Module-level singleton (not built per-render) -- react-leaflet's Marker
// diffs `icon` by reference and calls `marker.setIcon()` whenever it
// changes; a fresh L.DivIcon on every render fires that mid-drag and
// corrupts Leaflet's internal drag state (see QthMap.tsx's own comment,
// which hit exactly this in Studio).
const STATION_ICON: L.DivIcon = L.divIcon({
  className: classes.stationMarkerWrap,
  html: `<div class="${classes.stationMarker}"><div class="${classes.stationDot}"></div></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const TARGET_ICON: L.DivIcon = L.divIcon({
  className: classes.targetMarkerWrap,
  html: `<div class="${classes.targetMarker}"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/**
 * Cell selection sets a target (F5.5, Slice 5) -- the map's own `click`
 * event, distinct from the Marker's `drag`/`dragend` events above (Leaflet
 * scopes drag events to the marker target, so the two don't conflict, per
 * the phase plan's own note). `useMapEvents` (not `eventHandlers` on a
 * component, since there's no `<Map>` component to attach one to) is the
 * react-leaflet pattern this repo's own QthMap.tsx already uses for the
 * same click-to-place shape.
 */
function ClickToTarget({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export interface CoverageLayerProps {
  result: CoverageGridResult | null;
  pass: CoveragePass | null;
  station: { lat: number; lon: number } | null;
}

/**
 * Mounts `CoverageCanvasLayer` (Slice 2, F5.2) onto the map imperatively —
 * there's no first-class react-leaflet wrapper for an arbitrary canvas
 * layer, so this follows the same `useMap()` + `useEffect` pattern
 * `MapResizeFix` above already uses for non-declarative Leaflet API calls.
 */
function CoverageLayer({ result, pass, station }: CoverageLayerProps) {
  const map = useMap();
  const layerRef = useRef<CoverageCanvasLayer | null>(null);

  useEffect(() => {
    const layer = new CoverageCanvasLayer();
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!result || !station) return;
    layerRef.current?.setResult(
      result,
      { latDeg: station.lat, lonDeg: station.lon },
      pass ?? 'fine',
    );
  }, [result, pass, station]);

  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const parent = container.parentElement;
    if (!parent) return;

    const refresh = () => map.invalidateSize();
    requestAnimationFrame(refresh);

    const observer = new ResizeObserver(refresh);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export interface ReachMapProps {
  station: Station;
  /** Fires on every Leaflet `drag` event (continuous, mid-gesture) -- the live-recompute trigger (Slice 2). */
  onStationDrag: (lat: number, lon: number) => void;
  /** Fires once on `dragend` -- the only point a QTH change is persisted (Slice 1's own "debouncing applies to persistence, never to rendering" rule). */
  onStationDragEnd: (lat: number, lon: number) => void;
  /** The current coverage grid (Slice 2, F5.2) -- `null` before the first response arrives. */
  coverageResult: CoverageGridResult | null;
  coveragePass: CoveragePass | null;
  /** The station point `coverageResult` was actually computed for -- the live-drag position while dragging, `station.qth` otherwise. */
  coverageStation: { lat: number; lon: number } | null;
  /** The currently-recorded target (Slice 5, F5.5) -- `null` when un-targeted. */
  target: { lat: number; lon: number } | null;
  /** Fires on a map click/tap (not drag) -- sets the target (Slice 5). */
  onMapClick: (lat: number, lon: number) => void;
  /**
   * Fires on the target marker's own `dragend` (phase 13, F10.1's
   * "draggable on both map and globe" AC) -- optional so existing
   * callers/tests that don't need a draggable target marker can omit it;
   * the marker itself is only rendered `draggable` when this is provided.
   */
  onTargetDragEnd?: (lat: number, lon: number) => void;
  /**
   * Conditions' current instant (fix/reach-directionality-antenna-
   * greyline, Slice 5) -- drives the terminator line/sun marker's
   * position. Optional so existing callers/tests that don't care about
   * the greyline can omit it; `showTerminator` defaults to hidden when
   * `atMs` is absent regardless of its own value.
   */
  atMs?: number;
  /** Local Reach-only greyline toggle (Slice 5) -- default on, owned by ReachPage. */
  showTerminator?: boolean;
  /** Test seam only -- lets tests reach the underlying Leaflet Marker instance to fire drag/dragend without simulating real pointer geometry (jsdom has no layout engine). */
  markerRef?: Ref<L.Marker>;
  /** Test seam only -- same rationale as `markerRef`, for the map's own `click` event. */
  mapRef?: Ref<L.Map>;
}

export default function ReachMap({
  station,
  onStationDrag,
  onStationDragEnd,
  coverageResult,
  coveragePass,
  coverageStation,
  target,
  onMapClick,
  onTargetDragEnd,
  atMs,
  showTerminator,
  markerRef,
  mapRef,
}: ReachMapProps) {
  return (
    <div className={classes.wrapper}>
      <MapContainer
        ref={mapRef}
        center={[station.qth.lat, station.qth.lon]}
        zoom={DEFAULT_ZOOM}
        className={classes.map}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CoverageLayer result={coverageResult} pass={coveragePass} station={coverageStation} />
        {atMs !== undefined ? (
          <TerminatorLayer atMs={atMs} visible={showTerminator ?? false} />
        ) : null}
        <Marker
          ref={markerRef}
          position={[station.qth.lat, station.qth.lon]}
          icon={STATION_ICON}
          draggable
          eventHandlers={{
            drag(event) {
              const marker = event.target as L.Marker;
              const { lat, lng } = marker.getLatLng();
              onStationDrag(lat, lng);
            },
            dragend(event) {
              const marker = event.target as L.Marker;
              const { lat, lng } = marker.getLatLng();
              onStationDragEnd(lat, lng);
            },
          }}
        />
        {target ? (
          <Marker
            position={[target.lat, target.lon]}
            icon={TARGET_ICON}
            draggable={onTargetDragEnd != null}
            eventHandlers={
              onTargetDragEnd
                ? {
                    dragend(event) {
                      const marker = event.target as L.Marker;
                      const { lat, lng } = marker.getLatLng();
                      onTargetDragEnd(lat, lng);
                    },
                  }
                : undefined
            }
          />
        ) : null}
        <ClickToTarget onMapClick={onMapClick} />
        <MapResizeFix />
      </MapContainer>
    </div>
  );
}
