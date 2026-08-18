/**
 * Amateur HF band allocations (F4.8) — ported from Codeplug Studio's
 * `src/core/domain/bandCatalog.ts`, trimmed to the ten amateur HF bands
 * this app's engine actually models.
 *
 * Judgment call, flagged: "HF" here excludes `136khz`/`600m` (sub-MF/LF —
 * the engine models skywave/ionospheric HF propagation, not the
 * ground/surface-wave-dominated regime those bands actually use) and
 * excludes `6m` and above (VHF, outside the engine's modelled regime
 * entirely, per the product's HF framing throughout). `SERVICE_BANDS`/
 * `ALL_BANDS`/`BAND_SECTIONS` (broadcast/airband/marine/pmr) are also not
 * ported — this app has no use for them yet; only `UK_AMATEUR_BANDS`,
 * `bandFromFrequencyMhz` and `isAmateurBand` are kept, per this phase's
 * plan. `BandDefinition`'s shape (including `notes`) is unchanged from
 * Studio's.
 *
 * Deliberately NOT ported: `bandPlan.ts`'s separate Hz-keyed wrapper
 * (`BAND_PLAN`, `bandForFrequencyHz`) — this app already works in MHz
 * throughout the engine (phase 2/3's `frequencyMhz` convention), so that
 * wrapper would be a redundant unit-converting layer around data this
 * phase already has in the right units.
 */
export interface BandDefinition {
  id: string;
  label: string;
  minMhz: number;
  maxMhz: number;
  color: string;
  mantine: string;
  category: 'amateur' | 'broadcast' | 'airband' | 'marine' | 'pmr';
  notes?: string;
}

export const UK_AMATEUR_BANDS: BandDefinition[] = [
  {
    id: '160m',
    label: '160 m',
    minMhz: 1.81,
    maxMhz: 2.0,
    color: '#ae3ec9',
    mantine: 'grape.6',
    category: 'amateur',
  },
  {
    id: '80m',
    label: '80 m',
    minMhz: 3.5,
    maxMhz: 3.8,
    color: '#4263eb',
    mantine: 'indigo.6',
    category: 'amateur',
  },
  {
    id: '60m',
    label: '60 m',
    minMhz: 5.2585,
    maxMhz: 5.4065,
    color: '#f59f00',
    mantine: 'yellow.7',
    category: 'amateur',
    notes: 'Simple range lookup',
  },
  {
    id: '40m',
    label: '40 m',
    minMhz: 7.0,
    maxMhz: 7.2,
    color: '#2f9e44',
    mantine: 'green.7',
    category: 'amateur',
  },
  {
    id: '30m',
    label: '30 m',
    minMhz: 10.1,
    maxMhz: 10.15,
    color: '#12b886',
    mantine: 'teal.6',
    category: 'amateur',
    notes: 'Secondary allocation',
  },
  {
    id: '20m',
    label: '20 m',
    minMhz: 14.0,
    maxMhz: 14.35,
    color: '#0ca678',
    mantine: 'teal.7',
    category: 'amateur',
  },
  {
    id: '17m',
    label: '17 m',
    minMhz: 18.068,
    maxMhz: 18.168,
    color: '#099268',
    mantine: 'teal.8',
    category: 'amateur',
  },
  {
    id: '15m',
    label: '15 m',
    minMhz: 21.0,
    maxMhz: 21.45,
    color: '#40c057',
    mantine: 'green.6',
    category: 'amateur',
  },
  {
    id: '12m',
    label: '12 m',
    minMhz: 24.89,
    maxMhz: 24.99,
    color: '#82c91e',
    mantine: 'lime.6',
    category: 'amateur',
  },
  {
    id: '10m',
    label: '10 m',
    minMhz: 28.0,
    maxMhz: 29.7,
    color: '#fab005',
    mantine: 'yellow.6',
    category: 'amateur',
  },
];

export function isAmateurBand(band: BandDefinition): boolean {
  return band.category === 'amateur';
}

/**
 * `UK_AMATEUR_BANDS` is already in ascending-frequency order, so a
 * simple linear scan (matching Studio's own `ALL_BANDS` scan) is enough
 * — no need for the broader `ALL_BANDS` combined-and-sorted array
 * Studio's version iterates, since this app only has the one category.
 */
export function bandFromFrequencyMhz(mhz: number): BandDefinition | null {
  if (!Number.isFinite(mhz) || mhz <= 0) return null;
  for (const band of UK_AMATEUR_BANDS) {
    if (mhz >= band.minMhz && mhz <= band.maxMhz) return band;
  }
  return null;
}
