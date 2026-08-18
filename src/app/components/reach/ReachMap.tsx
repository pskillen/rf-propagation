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
import { useEffect, type Ref } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import type { Station } from '@core/domain/station/types';
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
  /** Test seam only -- lets tests reach the underlying Leaflet Marker instance to fire drag/dragend without simulating real pointer geometry (jsdom has no layout engine). */
  markerRef?: Ref<L.Marker>;
}

export default function ReachMap({
  station,
  onStationDrag,
  onStationDragEnd,
  markerRef,
}: ReachMapProps) {
  return (
    <div className={classes.wrapper}>
      <MapContainer
        center={[station.qth.lat, station.qth.lon]}
        zoom={DEFAULT_ZOOM}
        className={classes.map}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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
        <MapResizeFix />
      </MapContainer>
    </div>
  );
}
