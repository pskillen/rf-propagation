import type { ConditionsDriver } from '@core/domain/conditions/types';

/**
 * Fail-soft `localStorage` read/write for the fallback chain's
 * "last-known" tier (F4.7) — same pattern as phase 6's
 * `@integrations/station/persistence`, specialised to one storage key,
 * every load/save wrapped in try/catch and returning `null`/no-ops on
 * failure rather than throwing. A new module rather than a shared one:
 * Station and Conditions persist independently.
 *
 * Only ever stores a `kind === 'live'` driver value that came from a
 * successful `fetchLatestSpaceWeather()` call — this is *not* a separate
 * cache with its own TTL; it is simply not overwritten when a
 * subsequent fetch fails, so its `fetchedAtMs` naturally ages into the
 * "(N min ago)" provenance text the fallback chain re-serves it with.
 */

const LAST_KNOWN_DRIVER_STORAGE_KEY = 'rf-propagation.conditions.lastKnownDriver.v1';

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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Structural validity guard for a parsed, untyped value — same
 * "corrupt or outdated stored state degrades to null, not a partial
 * repair" contract as `@integrations/station/persistence`'s
 * `isValidStation`.
 */
function isValidLastKnownDriver(value: unknown): value is ConditionsDriver {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.kind === 'live' &&
    isFiniteNumber(candidate.sfi) &&
    isFiniteNumber(candidate.kp) &&
    isFiniteNumber(candidate.fetchedAtMs)
  );
}

export function loadLastKnownDriver(): ConditionsDriver | null {
  const parsed = readJson<unknown>(LAST_KNOWN_DRIVER_STORAGE_KEY);
  if (parsed === null || !isValidLastKnownDriver(parsed)) return null;
  return parsed;
}

/** Only ever called with a fresh `kind: 'live'` reading — see module doc above. */
export function saveLastKnownDriver(driver: ConditionsDriver): void {
  writeJson(LAST_KNOWN_DRIVER_STORAGE_KEY, driver);
}
