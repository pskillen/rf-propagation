// Cell selection sets a target (F5.5, Slice 5) -- "until Path exists
// (phase 13), surface the selection without a full Path view": a small
// panel/badge with a clear affordance, not a stub Path route (F5.5's own
// AC). Phase 13 takes this field over wholesale for the real Path view.
import { haversineDistanceKm, initialBearingDeg } from '../../lib/geo/bearingDistance.ts';
import { Button } from '../v2/index.ts';
import { formatLatLon } from './formatLatLon.ts';
import classes from './TargetPanel.module.css';

export interface TargetPanelProps {
  station: { lat: number; lon: number };
  target: { lat: number; lon: number };
  onClear: () => void;
}

export default function TargetPanel({ station, target, onClear }: TargetPanelProps) {
  const from = { latDeg: station.lat, lonDeg: station.lon };
  const to = { latDeg: target.lat, lonDeg: target.lon };
  const bearingDeg = initialBearingDeg(from, to);
  const rangeKm = haversineDistanceKm(from, to);

  return (
    <div className={classes.root} aria-label="Selected target">
      <p className={classes.line}>
        Target: {formatLatLon(target.lat, target.lon)} &middot; bearing {Math.round(bearingDeg)}
        &deg; &middot; {Math.round(rangeKm).toLocaleString()} km
      </p>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear target
      </Button>
    </div>
  );
}
