import type { NoiseEnvironment } from '../propagation/noise';

/**
 * Pattern-family literals ported from mk1's `AntennaPatternFamily` — same
 * four values, same meaning (see `@core/domain/antenna/antennaPattern.ts`
 * for the ported gain-shape math these drive).
 */
export type AntennaPatternFamily =
  | 'omnidirectional-vertical'
  | 'bidirectional-transverse'
  | 'directional-lobe'
  | 'multi-lobe-conical';

export interface AntennaConfig {
  id: string;
  name: string;
  family: AntennaPatternFamily;
  heightM: number;
  /** Required in practice for 'directional-lobe'; optional for the rest. */
  azimuthDeg?: number;
  /** 'multi-lobe-conical' only. */
  wireLengthWavelengths?: number;
  /**
   * Absolute nominal gain in dBi — mk1 has no equivalent (F4.3). Feeds
   * phase 3's `LinkBudgetInput.txAntennaGainDbi`/`rxAntennaGainDbi`
   * unchanged, no unit conversion at the call site.
   */
  gainDbi: number;
}

export type QthSource = 'geolocation' | 'maidenhead' | 'address' | 'map' | 'default';

export interface QthLocation {
  lat: number;
  lon: number;
  locator: string;
  source: QthSource;
  /** From a geocode/reverse-geocode result, when the source is 'address' or 'geolocation'. */
  label?: string;
}

export interface Station {
  qth: QthLocation;
  antennas: AntennaConfig[];
  activeAntennaId: string;
  powerW: number;
  /**
   * Phase 3's own `NoiseEnvironment` type, imported above — not redeclared.
   * Redeclaring this as a lookalike string union would compile today and
   * silently drift from phase 3's type the moment either side changes a
   * literal.
   */
  noiseEnvironment: NoiseEnvironment;
}

const ANTENNA_PATTERN_FAMILIES: readonly AntennaPatternFamily[] = [
  'omnidirectional-vertical',
  'bidirectional-transverse',
  'directional-lobe',
  'multi-lobe-conical',
];

const QTH_SOURCES: readonly QthSource[] = [
  'geolocation',
  'maidenhead',
  'address',
  'map',
  'default',
];

const NOISE_ENVIRONMENTS: readonly NoiseEnvironment[] = [
  'urban',
  'residential',
  'rural',
  'quietRural',
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidAntennaConfig(value: unknown): value is AntennaConfig {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.id) &&
    typeof candidate.name === 'string' &&
    ANTENNA_PATTERN_FAMILIES.includes(candidate.family as AntennaPatternFamily) &&
    isFiniteNumber(candidate.heightM) &&
    (candidate.azimuthDeg === undefined || isFiniteNumber(candidate.azimuthDeg)) &&
    (candidate.wireLengthWavelengths === undefined ||
      isFiniteNumber(candidate.wireLengthWavelengths)) &&
    isFiniteNumber(candidate.gainDbi)
  );
}

function isValidQthLocation(value: unknown): value is QthLocation {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isFiniteNumber(candidate.lat) &&
    isFiniteNumber(candidate.lon) &&
    isNonEmptyString(candidate.locator) &&
    QTH_SOURCES.includes(candidate.source as QthSource) &&
    (candidate.label === undefined || typeof candidate.label === 'string')
  );
}

/**
 * Structural validity guard for a parsed, untyped value — used by
 * `loadStation()` (`@integrations/station/persistence`) to reject not just
 * malformed JSON but a schema that has drifted from the current `Station`
 * shape. "Corrupt **or outdated** stored state falls back to defaults"
 * (F4.1) means a schema change between app versions must degrade the same
 * way a truncated JSON blob does — this is that check. Deliberately
 * conservative: any unexpected shape returns `false` rather than attempting
 * a partial repair.
 */
export function isValidStation(value: unknown): value is Station {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (!isValidQthLocation(candidate.qth)) return false;
  if (!Array.isArray(candidate.antennas) || candidate.antennas.length === 0) return false;
  if (!candidate.antennas.every(isValidAntennaConfig)) return false;
  if (typeof candidate.activeAntennaId !== 'string') return false;

  const antennas = candidate.antennas as AntennaConfig[];
  if (!antennas.some((antenna) => antenna.id === candidate.activeAntennaId)) return false;

  if (!isFiniteNumber(candidate.powerW) || candidate.powerW <= 0) return false;
  if (!NOISE_ENVIRONMENTS.includes(candidate.noiseEnvironment as NoiseEnvironment)) return false;

  return true;
}
