import type { GroundType } from '@core/domain/propagation/losses';
import type { ConditionsDriverKind } from '@core/domain/conditions/types';
import type { UrlStateFieldCodec } from '../codec.ts';
import type { ConditionsUrlState } from '../types.ts';

const DRIVER_KINDS: readonly ConditionsDriverKind[] = ['live', 'manual', 'preset'];
const GROUND_TYPES: readonly GroundType[] = ['sea', 'land', 'mixed'];

function isDriverKind(value: string): value is ConditionsDriverKind {
  return (DRIVER_KINDS as readonly string[]).includes(value);
}

function isGroundType(value: string): value is GroundType {
  return (GROUND_TYPES as readonly string[]).includes(value);
}

function parseFiniteNumber(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Conditions URL codec — round-trips `atMs` (only while non-live), the
 * solar driver's kind/SFI/Kp (only while not `'live'` — see
 * `ConditionsUrlState`'s own doc comment in `../types.ts` for why), and
 * ground type. Every field is an override, same "absent means app's own
 * current/default value" contract as `stationFieldCodec`.
 */
export const conditionsFieldCodec: UrlStateFieldCodec<'conditions'> = {
  key: 'conditions',
  encode(value, params) {
    if (value.t !== undefined) params.set('t', String(value.t));
    if (value.dk !== undefined) params.set('dk', value.dk);
    if (value.sfi !== undefined) params.set('sfi', String(value.sfi));
    if (value.kp !== undefined) params.set('kp', String(value.kp));
    if (value.gnd !== undefined) params.set('gnd', value.gnd);
  },
  decode(params, defaults) {
    const dkRaw = params.get('dk');
    const gndRaw = params.get('gnd');

    return {
      t: parseFiniteNumber(params.get('t')) ?? defaults.conditions.t,
      dk: dkRaw && isDriverKind(dkRaw) ? dkRaw : defaults.conditions.dk,
      sfi: parseFiniteNumber(params.get('sfi')) ?? defaults.conditions.sfi,
      kp: parseFiniteNumber(params.get('kp')) ?? defaults.conditions.kp,
      gnd: gndRaw && isGroundType(gndRaw) ? gndRaw : defaults.conditions.gnd,
    };
  },
};

/**
 * The runtime meaning of `ConditionsUrlState.t`'s absence: "a plain link
 * with no `t` means now" (F4.6). Used by `ConditionsBar` to seed
 * `useConditions`'s initial `{ atMs, liveNow }` from a decoded URL —
 * pulled out as its own small, pure, directly-testable function rather
 * than inlined, since this exact mapping is the thing Slice 1's
 * acceptance criteria call out ("a URL with no t param decodes to
 * liveNow: true, atMs near Date.now()").
 */
export function conditionsUrlStateToInitialTime(urlState: ConditionsUrlState): {
  atMs: number;
  liveNow: boolean;
} {
  if (urlState.t === undefined) {
    return { atMs: Date.now(), liveNow: true };
  }
  return { atMs: urlState.t, liveNow: false };
}
