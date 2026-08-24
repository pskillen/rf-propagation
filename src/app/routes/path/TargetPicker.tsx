/**
 * Path's target picker (F10.1, [#76]) — three entry modes
 * (coordinates/locator/address), a draggable map fallback, and the
 * resolved coordinates/bearing/great-circle-distance readout. Adapted
 * from `StationBar`'s own `QthPicker.tsx` structure (same
 * geocode/locator/map funnel-through-one-setter shape), with a
 * `'coordinates'` mode instead of `QthPicker`'s geolocation button (a
 * target isn't "where am I right now").
 *
 * `resolveTarget.ts` holds the pure resolution logic this component
 * wraps; see that module's own doc comment for why it returns
 * `ViewerState.target`'s own `Target` shape directly rather than a
 * separate `ResolvedTarget` type.
 *
 * [#76]: https://github.com/pskillen/rf-propagation/issues/76
 */
import { useEffect, useState } from 'react';
import { coordsToLocator } from '@core/domain/maidenhead';
import { geocodeQuery, GeocodeError, type GeocodeResult } from '@integrations/geocode';
import {
  formatBearing,
  formatDistanceKmAndMi,
  haversineDistanceKm,
  initialBearingDeg,
} from '../../lib/geo/bearingDistance.ts';
import {
  Button,
  Combobox,
  SegmentedControl,
  TextInput,
  type ComboboxOption,
} from '../../components/v2/index.ts';
import { formatLatLon } from '../../components/reach/formatLatLon.ts';
import type { Target } from '../../state/viewerState.tsx';
import QthMap from '../../components/station/QthMap.tsx';
import { resolveTarget, type TargetPickMode } from './resolveTarget.ts';
import classes from './TargetPicker.module.css';

const ADDRESS_SEARCH_DEBOUNCE_MS = 300;
const MIN_ADDRESS_QUERY_LENGTH = 3;

const MODE_OPTIONS: { value: TargetPickMode; label: string }[] = [
  { value: 'coordinates', label: 'Coordinates' },
  { value: 'locator', label: 'Locator' },
  { value: 'address', label: 'Address' },
];

export interface TargetPickerProps {
  station: { lat: number; lon: number };
  target: Target | null;
  onTargetChange: (target: Target | null) => void;
}

export default function TargetPicker({ station, target, onTargetChange }: TargetPickerProps) {
  const [mode, setMode] = useState<TargetPickMode>('coordinates');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [coordError, setCoordError] = useState<string | null>(null);

  const [locatorInput, setLocatorInput] = useState('');
  const [locatorError, setLocatorError] = useState<string | null>(null);

  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  function handleSetCoordinates() {
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    const resolved = resolveTarget({
      mode: 'coordinates',
      manualLat: lat,
      manualLon: lon,
      locatorInput: '',
      geocodedCoords: null,
      geocodedLabel: null,
    });
    if (!resolved) {
      setCoordError('Enter a latitude between -90 and 90 and a longitude between -180 and 180.');
      return;
    }
    setCoordError(null);
    onTargetChange(resolved);
  }

  function handleSetLocator() {
    const resolved = resolveTarget({
      mode: 'locator',
      manualLat: 0,
      manualLon: 0,
      locatorInput,
      geocodedCoords: null,
      geocodedLabel: null,
    });
    if (!resolved) {
      setLocatorError('Enter a valid 4 or 6-character Maidenhead locator (e.g. IO85 or IO85vs).');
      return;
    }
    setLocatorError(null);
    onTargetChange(resolved);
  }

  // Debounced address search -- same shape as QthPicker's own effect
  // (this app's Photon-backed geocoder, per this phase's own "Photon
  // only, no provider selector" note).
  useEffect(() => {
    const trimmed = addressQuery.trim();
    let cancelled = false;

    const timer = setTimeout(() => {
      const run = async () => {
        if (trimmed.length < MIN_ADDRESS_QUERY_LENGTH) {
          if (!cancelled) {
            setAddressResults([]);
            setAddressError(null);
            setAddressLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setAddressLoading(true);
          setAddressError(null);
        }

        try {
          const result = await geocodeQuery(trimmed, { provider: 'photon' });
          if (cancelled) return;
          const results = result ? [result] : [];
          setAddressResults(results);
          if (results.length === 0) setAddressError('No results found.');
        } catch (err) {
          if (cancelled) return;
          // A failed geocode must not leave a stale ResolvedTarget from a
          // previous successful lookup -- clearing results here means the
          // next resolveTarget({mode:'address', ...}) call sees
          // geocodedCoords: null, per resolveTarget.ts's own contract.
          setAddressResults([]);
          setAddressError(err instanceof GeocodeError ? err.message : 'Address search failed.');
        } finally {
          if (!cancelled) setAddressLoading(false);
        }
      };
      void run();
    }, ADDRESS_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addressQuery]);

  function handleSelectAddress(option: ComboboxOption<GeocodeResult>) {
    const resolved = resolveTarget({
      mode: 'address',
      manualLat: 0,
      manualLon: 0,
      locatorInput: '',
      geocodedCoords: option.value,
      geocodedLabel: option.label,
    });
    setAddressQuery('');
    setAddressResults([]);
    setAddressError(null);
    onTargetChange(resolved);
  }

  function handleMapChange(lat: number, lon: number) {
    onTargetChange({ lat, lon, source: 'map' });
  }

  const addressComboboxOptions: ComboboxOption<GeocodeResult>[] =
    addressQuery.trim().length >= MIN_ADDRESS_QUERY_LENGTH
      ? addressResults.map((result) => ({ value: result, label: result.label }))
      : [];
  const addressEmptyMessage =
    addressQuery.trim().length > 0 && addressQuery.trim().length < MIN_ADDRESS_QUERY_LENGTH
      ? 'Type at least 3 characters'
      : (addressError ?? 'No results');

  const bearingDeg = target
    ? initialBearingDeg(
        { latDeg: station.lat, lonDeg: station.lon },
        { latDeg: target.lat, lonDeg: target.lon },
      )
    : null;
  const rangeKm = target
    ? haversineDistanceKm(
        { latDeg: station.lat, lonDeg: station.lon },
        { latDeg: target.lat, lonDeg: target.lon },
      )
    : null;

  return (
    <div className={classes.root}>
      {target && bearingDeg != null && rangeKm != null ? (
        <div className={classes.resolved} aria-label="Resolved target">
          <div className={classes.resolvedTop}>
            <span className={classes.resolvedCoords}>
              {target.label ?? formatLatLon(target.lat, target.lon)} · {target.lat.toFixed(5)}°,{' '}
              {target.lon.toFixed(5)}° ({coordsToLocator(target.lat, target.lon)})
            </span>
            <Button variant="ghost" size="sm" onClick={() => onTargetChange(null)}>
              Clear target
            </Button>
          </div>
          <span className={classes.resolvedLine}>
            {formatBearing(bearingDeg)} · {formatDistanceKmAndMi(rangeKm)}
          </span>
        </div>
      ) : null}

      <div className={classes.modes}>
        <SegmentedControl
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
          aria-label="Target entry mode"
        />
      </div>

      {mode === 'coordinates' ? (
        <div className={classes.row}>
          <div className={classes.coordFields}>
            <TextInput
              label="Latitude"
              type="number"
              step="any"
              placeholder="51.5074"
              value={manualLat}
              onChange={(event) => setManualLat(event.target.value)}
            />
            <TextInput
              label="Longitude"
              type="number"
              step="any"
              placeholder="-0.1278"
              value={manualLon}
              onChange={(event) => setManualLon(event.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={handleSetCoordinates}>
            Set
          </Button>
        </div>
      ) : null}
      {mode === 'coordinates' && coordError ? (
        <span className={classes.error}>{coordError}</span>
      ) : null}

      {mode === 'locator' ? (
        <div className={classes.row}>
          <TextInput
            label="Maidenhead locator"
            placeholder="IO85vs"
            value={locatorInput}
            onChange={(event) => setLocatorInput(event.target.value)}
          />
          <Button variant="secondary" onClick={handleSetLocator}>
            Set
          </Button>
        </div>
      ) : null}
      {mode === 'locator' && locatorError ? (
        <span className={classes.error}>{locatorError}</span>
      ) : null}

      {mode === 'address' ? (
        <Combobox
          inputValue={addressQuery}
          onInputChange={setAddressQuery}
          options={addressComboboxOptions}
          loading={addressLoading}
          onSelect={handleSelectAddress}
          placeholder="Search an address or place…"
          emptyMessage={addressEmptyMessage}
        />
      ) : null}

      <div className={classes.map}>
        <QthMap
          value={target ? { lat: target.lat, lon: target.lon } : null}
          onChange={handleMapChange}
        />
      </div>
    </div>
  );
}
