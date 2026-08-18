import type { Conditions } from './types';

/**
 * SFI 120 / Kp 2 is not an arbitrary "quiet, moderate" guess — it
 * deliberately matches phase 3's own Anchor A calibration scenario
 * (14 MHz, daytime, SFI 120, rural, 100 W into 6 dBi — see
 * `03-engine-link-budget-reliability.md`'s Slice 6), so a fresh
 * visitor's very first coverage picture (once Reach exists in phase 8)
 * matches the model's own validated reference case rather than an
 * arbitrary point nobody has checked.
 */
export const DEFAULT_CONDITIONS: Conditions = {
  atMs: Date.now(),
  liveNow: true,
  driver: { kind: 'preset', sfi: 120, kp: 2 },
  ground: 'land',
};
