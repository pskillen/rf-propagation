import { UK_AMATEUR_BANDS } from '@core/domain/bandCatalog';
import type { UrlStateFieldCodec } from '../codec.ts';

const KNOWN_BAND_IDS = new Set(UK_AMATEUR_BANDS.map((band) => band.id));

/**
 * Band selection URL codec — a single string id, validated against the
 * trimmed amateur-HF catalogue (`@core/domain/bandCatalog`). Unlike
 * Station/Conditions' fields, `bandId` always has a value (there's no
 * "no band selected" state), so it's encoded whenever it differs from
 * the default rather than only when "present" — a malformed or
 * out-of-catalogue `b` param decodes to the default band instead of
 * throwing or crashing.
 */
export const bandFieldCodec: UrlStateFieldCodec<'bandId'> = {
  key: 'bandId',
  encode(value, params) {
    if (value) params.set('b', value);
  },
  decode(params, defaults) {
    const raw = params.get('b');
    if (raw && KNOWN_BAND_IDS.has(raw)) return raw;
    return defaults.bandId;
  },
};
