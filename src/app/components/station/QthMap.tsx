// Ported from Codeplug Studio's src/app/routes/tracking/ObserverLocationMap.tsx
// (rename only — same props, same module-level L.DivIcon singleton pattern,
// same click-to-place and drag-to-adjust behaviour). `LatLon` was a
// `@core/domain/geo.ts` import in Studio (no equivalent module here) —
// replaced with a small local tuple type of the same shape.
//
// leaflet/dist/leaflet.css is imported at this component's own module
// level (not globally at the app root) so the CSS isn't pulled into every
// route's bundle — this is the first and only leaflet consumer in the app
// so far.
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import classes from './QthMap.module.css';

type LatLon = [number, number];

const DEFAULT_CENTER: LatLon = [20, 0];
const DEFAULT_ZOOM = 2;
/** Zoom level the map jumps to the first time a location is set (world view → street-ish). */
const FOCUS_ZOOM = 11;

export interface QthMapValue {
  lat: number;
  lon: number;
}

export interface QthMapProps {
  value: QthMapValue | null;
  onChange: (lat: number, lon: number) => void;
}

// Module-level singleton, built once rather than called per render.
// react-leaflet's Marker diffs `icon` by reference and calls
// `marker.setIcon()` whenever it changes; a fresh L.DivIcon on every render
// made that fire on every re-render, including mid-drag, which corrupted
// Leaflet's internal drag state and crashed the map (caught only via live
// browser testing in Studio — see ObserverLocationMap.tsx's own comment).
const PIN_ICON: L.DivIcon = L.divIcon({
  className: classes.pinMarkerWrap,
  html: `<div class="${classes.pinMarker}"><div class="${classes.pinDot}"></div></div>`,
  iconAnchor: [6, 6],
});

function ClickToPlace({ onPlace }: { onPlace: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onPlace(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function MapViewController({ value }: { value: QthMapValue | null }) {
  const map = useMap();
  const hasFocusedRef = useRef(false);

  useEffect(() => {
    if (!value) return;
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true;
      map.setView([value.lat, value.lon], Math.max(map.getZoom(), FOCUS_ZOOM));
      return;
    }
    map.setView([value.lat, value.lon], map.getZoom());
  }, [map, value]);

  return null;
}

/**
 * Minimap pin-drop for the operator's QTH — click to place, drag to
 * adjust. Dragging the pin is the primary gesture (FR-28); the coordinate
 * field in QthPicker is the fallback.
 */
export default function QthMap({ value, onChange }: QthMapProps) {
  const center: LatLon = value ? [value.lat, value.lon] : DEFAULT_CENTER;
  const zoom = value ? FOCUS_ZOOM : DEFAULT_ZOOM;

  return (
    <div className={classes.wrapper}>
      <MapContainer center={center} zoom={zoom} className={classes.map} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {value ? (
          <Marker
            position={[value.lat, value.lon]}
            draggable
            icon={PIN_ICON}
            eventHandlers={{
              dragend: (event) => {
                const marker = event.target as L.Marker;
                const position = marker.getLatLng();
                onChange(position.lat, position.lng);
              },
            }}
          />
        ) : null}
        <ClickToPlace onPlace={onChange} />
        <MapViewController value={value} />
      </MapContainer>
      {!value ? <p className={classes.hint}>Click the map to drop a pin.</p> : null}
    </div>
  );
}
