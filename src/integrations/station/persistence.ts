import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { isValidStation, type Station } from '@core/domain/station/types';

/**
 * Fail-soft `localStorage` read/write, replicating the pattern from
 * Codeplug Studio's `src/integrations/listPrefs/storage.ts` (this app has
 * no `projectId` scoping, so it's specialised to one storage key rather
 * than ported verbatim). Every load/save wraps in try/catch and returns
 * `null`/no-ops on failure rather than throwing.
 */

const STATION_STORAGE_KEY = 'rf-propagation.station.v1';

function readJson<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw === null || raw === undefined) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore write failures (quota, disabled storage).
  }
}

/**
 * Returns the persisted `Station`, or `null` if nothing is stored, the
 * stored JSON is corrupt, or the parsed value's shape doesn't pass
 * `isValidStation` — a schema that has drifted between app versions
 * degrades exactly like truncated JSON: fall back to defaults instead of
 * breaking the app.
 */
export function loadStation(): Station | null {
  const parsed = readJson<unknown>(STATION_STORAGE_KEY);
  if (parsed === null || !isValidStation(parsed)) return null;
  return parsed;
}

export function saveStation(station: Station): void {
  writeJson(STATION_STORAGE_KEY, station);
}

/**
 * Load-or-default, spread-merge the patch on top, save, and return the
 * merged `Station`. Every Station-editing UI component funnels its writes
 * through this single function.
 */
export function mergeStation(patch: Partial<Station>): Station {
  const current = loadStation() ?? DEFAULT_STATION;
  const next: Station = { ...current, ...patch };
  saveStation(next);
  return next;
}
