// Adapts Codeplug Studio's ObserverLocationSettings.tsx sync pattern: every
// route into the picker (geolocation, Maidenhead entry, address search, map
// drag) funnels through one `setQth` call so the four conveniences stay
// synchronised by construction. Uses this app's Photon-backed geocoder
// (@integrations/geocode) instead of Studio's Nominatim client.
import { useEffect, useState } from 'react';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead';
import type { QthLocation, QthSource, Station } from '@core/domain/station/types';
import { geocodeQuery, GeocodeError, type GeocodeResult } from '@integrations/geocode';
import { mergeStation } from '@integrations/station/persistence';
import { Button, Combobox, TextInput, type ComboboxOption } from '../v2/index.ts';
import UseMyLocationButton from './UseMyLocationButton.tsx';
import QthMap from './QthMap.tsx';
import classes from './QthPicker.module.css';

const ADDRESS_SEARCH_DEBOUNCE_MS = 300;
const MIN_ADDRESS_QUERY_LENGTH = 3;

export interface QthPickerProps {
  qth: QthLocation;
  onStationChange: (station: Station) => void;
}

function setQth(
  next: { lat: number; lon: number; source: QthSource; label?: string },
  onStationChange: (station: Station) => void,
) {
  const locator = coordsToLocator(next.lat, next.lon);
  onStationChange(mergeStation({ qth: { ...next, locator } }));
}

export default function QthPicker({ qth, onStationChange }: QthPickerProps) {
  const [locatorInput, setLocatorInput] = useState('');
  const [locatorError, setLocatorError] = useState<string | null>(null);

  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<GeocodeResult[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  function handleGeolocation(lat: number, lon: number) {
    setLocatorInput(coordsToLocator(lat, lon));
    setQth({ lat, lon, source: 'geolocation' }, onStationChange);
  }

  function handleSetLocator() {
    const trimmed = locatorInput.trim();
    if (!isValidLocator(trimmed)) {
      setLocatorError('Enter a valid 4 or 6-character Maidenhead locator (e.g. IO85 or IO85vs).');
      return;
    }
    setLocatorError(null);
    const location = locatorToCoords(trimmed);
    if (!location) {
      setLocatorError('Could not convert that locator to coordinates.');
      return;
    }
    setQth({ lat: location.lat, lon: location.lon, source: 'maidenhead' }, onStationChange);
  }

  // Debounced address search — mirrors Studio's ObserverLocationSettings.tsx
  // setTimeout/cancelled pattern, against this app's Photon-backed geocoder.
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
          const result = await geocodeQuery(trimmed);
          if (cancelled) return;
          const results = result ? [result] : [];
          setAddressResults(results);
          if (results.length === 0) setAddressError('No results found.');
        } catch (err) {
          if (cancelled) return;
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
    const { lat, lon } = option.value;
    setLocatorInput(coordsToLocator(lat, lon));
    setAddressQuery('');
    setAddressResults([]);
    setAddressError(null);
    setQth({ lat, lon, source: 'address', label: option.label }, onStationChange);
  }

  function handleMapChange(lat: number, lon: number) {
    setLocatorInput(coordsToLocator(lat, lon));
    setQth({ lat, lon, source: 'map' }, onStationChange);
  }

  const addressComboboxOptions: ComboboxOption<GeocodeResult>[] =
    addressQuery.trim().length >= MIN_ADDRESS_QUERY_LENGTH
      ? addressResults.map((result) => ({ value: result, label: result.label }))
      : [];
  const addressEmptyMessage =
    addressQuery.trim().length > 0 && addressQuery.trim().length < MIN_ADDRESS_QUERY_LENGTH
      ? 'Type at least 3 characters'
      : (addressError ?? 'No results');

  const currentLabel = `${qth.lat.toFixed(4)}, ${qth.lon.toFixed(4)} (${qth.locator})`;

  return (
    <div className={classes.layout}>
      <div className={classes.inputsColumn}>
        <p className={classes.current}>
          Current: <strong>{currentLabel}</strong>
        </p>

        <div className={classes.row}>
          <UseMyLocationButton onLocation={handleGeolocation} />
        </div>

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
        {locatorError ? <span className={classes.error}>{locatorError}</span> : null}

        <div className={classes.section}>
          <span className={classes.sectionLabel}>Search address</span>
          <Combobox
            inputValue={addressQuery}
            onInputChange={setAddressQuery}
            options={addressComboboxOptions}
            loading={addressLoading}
            onSelect={handleSelectAddress}
            placeholder="Search an address or place…"
            emptyMessage={addressEmptyMessage}
          />
        </div>
      </div>

      <div className={classes.mapColumn}>
        <span className={classes.sectionLabel}>Or drop a pin</span>
        <QthMap value={{ lat: qth.lat, lon: qth.lon }} onChange={handleMapChange} />
      </div>
    </div>
  );
}
