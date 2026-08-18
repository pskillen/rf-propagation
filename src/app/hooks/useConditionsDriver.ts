// Fallback chain for the solar/geomagnetic driver (F4.7): live → last-known
// (with age shown) → manual entry → canned preset, in that exact order,
// with provenance always displayed. A fetch failure degrades silently to
// the next tier — never throws past this hook, never shows a modal.
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import type { ConditionsDriver } from '@core/domain/conditions/types';
import {
  fetchLatestSpaceWeather,
  type SpaceWeatherReading,
} from '@integrations/spaceWeather/noaaClient';
import { loadLastKnownDriver, saveLastKnownDriver } from '@integrations/conditions/persistence';

// The upstream feeds themselves cache at max-age=60; this is the
// client-side guard against re-fetching more often than that.
const FETCH_TTL_MS = 60_000;

export interface UseConditionsDriverResult {
  driver: ConditionsDriver;
  /** Operator-entered SFI/Kp — takes precedence until cleared. */
  setManualDriver: (sfi: number, kp: number) => void;
  /** "Switch back" — resume live/last-known/preset. */
  clearManualDriver: () => void;
  isManual: boolean;
}

/**
 * `driver.kind` alone doesn't distinguish a fresh live fetch from a
 * stale last-known one — both are `'live'`; the fallback chain's third
 * tier is "not a separate cache, just not overwriting on failure" (see
 * `@integrations/conditions/persistence`'s module doc). The operator
 * tells them apart from this text's age, e.g. "(0 min ago)" vs.
 * "(43 min ago)".
 */
export function describeDriverProvenance(driver: ConditionsDriver, nowMs = Date.now()): string {
  switch (driver.kind) {
    case 'manual':
      return 'Manual';
    case 'preset':
      return 'Preset';
    case 'live': {
      if (driver.fetchedAtMs === undefined) return 'Live';
      const minutesAgo = Math.max(0, Math.round((nowMs - driver.fetchedAtMs) / 60_000));
      return `Live (${minutesAgo} min ago)`;
    }
    default:
      return 'Unknown';
  }
}

export function useConditionsDriver(
  initialManual?: { sfi: number; kp: number } | null,
): UseConditionsDriverResult {
  const [manual, setManual] = useState<{ sfi: number; kp: number } | null>(initialManual ?? null);
  // Seeded once, synchronously, from persistence — so a fresh mount with
  // no network yet still shows "last-known" rather than flashing preset
  // first. See @integrations/conditions/persistence's fail-soft contract.
  const [lastKnown, setLastKnown] = useState<ConditionsDriver | null>(() => loadLastKnownDriver());
  const [liveReading, setLiveReading] = useState<SpaceWeatherReading | null>(null);
  const lastFetchAttemptMsRef = useRef(0);

  const attemptFetch = useCallback(() => {
    const now = Date.now();
    if (now - lastFetchAttemptMsRef.current < FETCH_TTL_MS) return;
    lastFetchAttemptMsRef.current = now;

    fetchLatestSpaceWeather()
      .then((reading) => {
        setLiveReading(reading);
        const persisted: ConditionsDriver = {
          kind: 'live',
          sfi: reading.sfi,
          kp: reading.kp,
          fetchedAtMs: reading.observedAtMs,
        };
        setLastKnown(persisted);
        saveLastKnownDriver(persisted);
      })
      .catch(() => {
        // Fetch failure degrades silently — the next render just falls
        // through to last-known/preset below. Never throw past this hook.
      });
  }, []);

  useEffect(() => {
    attemptFetch();
    const id = setInterval(attemptFetch, FETCH_TTL_MS);
    return () => clearInterval(id);
  }, [attemptFetch]);

  const setManualDriver = useCallback((sfi: number, kp: number) => {
    setManual({ sfi, kp });
  }, []);

  const clearManualDriver = useCallback(() => {
    setManual(null);
  }, []);

  let driver: ConditionsDriver;
  if (manual) {
    driver = { kind: 'manual', sfi: manual.sfi, kp: manual.kp };
  } else if (liveReading) {
    driver = {
      kind: 'live',
      sfi: liveReading.sfi,
      kp: liveReading.kp,
      fetchedAtMs: liveReading.observedAtMs,
    };
  } else if (lastKnown) {
    driver = lastKnown;
  } else {
    driver = DEFAULT_CONDITIONS.driver;
  }

  return { driver, setManualDriver, clearManualDriver, isManual: manual !== null };
}
