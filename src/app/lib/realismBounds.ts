/**
 * Realism-unlock bounds (F7.3, phase 10's Slice 3) — locked vs unlocked
 * `min`/`max` for every input the design docs don't specify numerically.
 * All of this is this phase's own judgment call, not derived from a spec
 * value anywhere in the design doc set — see this phase's PR description
 * for the reasoning behind each number, and flag freely if a later phase
 * or reviewer wants to change any of them; none of this is a contract.
 *
 * Antenna height specifically: the plan file assumed mk1's own
 * `MIN_HEIGHT_M`/`MAX_HEIGHT_M` had already been ported (phase 6) as
 * this phase's "locked" bound — verified against the actual repo and
 * that ported constant does not exist; `AntennaList.tsx`'s height field
 * has never had bounds. This phase adds `MIN_ANTENNA_HEIGHT_M`/
 * `MAX_ANTENNA_HEIGHT_M` fresh, using the plan file's suggested numbers
 * as the locked range since nothing else in the repo defines one.
 */
import type { BandDefinition } from '@core/domain/bandCatalog';

export interface Range {
  min: number;
  max: number;
}

export const REALISTIC_SFI_RANGE: Range = { min: 60, max: 300 };
export const UNLOCKED_SFI_RANGE: Range = { min: 0, max: 500 };

// Kp's 0-9 scale IS the real scale -- unlocking has no numeric effect,
// kept symmetrical with the other four inputs only so callers don't need
// a special case.
export const REALISTIC_KP_RANGE: Range = { min: 0, max: 9 };
export const UNLOCKED_KP_RANGE: Range = { min: 0, max: 9 };

export const MIN_ANTENNA_HEIGHT_M = 1;
export const MAX_ANTENNA_HEIGHT_M = 30;
export const REALISTIC_ANTENNA_HEIGHT_RANGE: Range = {
  min: MIN_ANTENNA_HEIGHT_M,
  max: MAX_ANTENNA_HEIGHT_M,
};
export const UNLOCKED_ANTENNA_HEIGHT_RANGE: Range = { min: 0.5, max: 500 };

export const UNLOCKED_FREQUENCY_RANGE_MHZ: Range = { min: 1, max: 30 };

export const REALISTIC_TX_POWER_RANGE_W: Range = { min: 1, max: 1500 };
export const UNLOCKED_TX_POWER_RANGE_W: Range = { min: 1, max: 100_000 };

export function sfiRange(unlocked: boolean): Range {
  return unlocked ? UNLOCKED_SFI_RANGE : REALISTIC_SFI_RANGE;
}

export function kpRange(unlocked: boolean): Range {
  return unlocked ? UNLOCKED_KP_RANGE : REALISTIC_KP_RANGE;
}

export function antennaHeightRange(unlocked: boolean): Range {
  return unlocked ? UNLOCKED_ANTENNA_HEIGHT_RANGE : REALISTIC_ANTENNA_HEIGHT_RANGE;
}

/** Realistic bound is the selected band's own edges -- unlocked ignores the band entirely. */
export function frequencyRange(unlocked: boolean, band: BandDefinition): Range {
  return unlocked ? UNLOCKED_FREQUENCY_RANGE_MHZ : { min: band.minMhz, max: band.maxMhz };
}

export function txPowerRange(unlocked: boolean): Range {
  return unlocked ? UNLOCKED_TX_POWER_RANGE_W : REALISTIC_TX_POWER_RANGE_W;
}

function inRange(value: number, range: Range): boolean {
  return value >= range.min && value <= range.max;
}

export function clamp(value: number, range: Range): number {
  return Math.min(range.max, Math.max(range.min, value));
}

export function isSfiOutOfRealisticBounds(sfi: number): boolean {
  return !inRange(sfi, REALISTIC_SFI_RANGE);
}

export function isKpOutOfRealisticBounds(kp: number): boolean {
  return !inRange(kp, REALISTIC_KP_RANGE);
}

export function isAntennaHeightOutOfRealisticBounds(heightM: number): boolean {
  return !inRange(heightM, REALISTIC_ANTENNA_HEIGHT_RANGE);
}

export function isFrequencyOutOfRealisticBounds(
  frequencyMhz: number,
  band: BandDefinition,
): boolean {
  return !inRange(frequencyMhz, { min: band.minMhz, max: band.maxMhz });
}

export function isTxPowerOutOfRealisticBounds(powerW: number): boolean {
  return !inRange(powerW, REALISTIC_TX_POWER_RANGE_W);
}

/**
 * The single derived boolean F7.3's "every answer surface shows a 'not
 * the real world' state" AC calls for — computed once, read by both
 * Reach's and the globe's chrome, rather than duplicating the check in
 * each surface.
 */
export function anyInputOutOfRealisticBounds(input: {
  sfi: number;
  kp: number;
  heightM: number;
  frequencyMhz: number;
  band: BandDefinition;
  powerW: number;
}): boolean {
  return (
    isSfiOutOfRealisticBounds(input.sfi) ||
    isKpOutOfRealisticBounds(input.kp) ||
    isAntennaHeightOutOfRealisticBounds(input.heightM) ||
    isFrequencyOutOfRealisticBounds(input.frequencyMhz, input.band) ||
    isTxPowerOutOfRealisticBounds(input.powerW)
  );
}
