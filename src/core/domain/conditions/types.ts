import type { GroundType } from '../propagation/losses';

/**
 * Where the solar/geomagnetic driver values came from — surfaced to the
 * operator as always-visible provenance (F4.7). `'live'` covers both a
 * fresh NOAA SWPC fetch and a stale last-known value re-served after a
 * failed fetch; the two are distinguished in the UI by the age computed
 * from `fetchedAtMs`, not by a separate kind literal — see
 * `useConditionsDriver.ts`'s fallback chain for why "last-known" isn't
 * its own state here.
 */
export type ConditionsDriverKind = 'live' | 'manual' | 'preset';

export interface ConditionsDriver {
  kind: ConditionsDriverKind;
  /**
   * Plain Solar Flux Index — NOT SSN. The SFI→SSN conversion
   * (`ssnFromSfi`) happens inside phase 3's `linkBudget.ts`/`losses.ts`,
   * never here. Getting this unit wrong here is a silent bug with no
   * compiler error to catch it — see the phase 7 plan's "Physics/engine
   * invariant note".
   */
  sfi: number;
  /**
   * Plain 0–9 Kp index — NOT NOAA's alphanumeric `kp` classification
   * string (e.g. `"1M"`). This is `kp_index` from
   * `planetary_k_index_1m.json`, converted at the integration boundary
   * in `@integrations/spaceWeather/noaaClient`.
   */
  kp: number;
  /** When a 'live' value was actually fetched — drives "(12 min ago)". */
  fetchedAtMs?: number;
  /** Set when `kind === 'preset'`. */
  presetId?: string;
}

export interface Conditions {
  atMs: number;
  /** true ⇒ atMs tracks Date.now(); false ⇒ atMs is fixed at whatever it was last set to. */
  liveNow: boolean;
  driver: ConditionsDriver;
  /** Imported from phase 3's `losses.ts` above, not redeclared. */
  ground: GroundType;
}
