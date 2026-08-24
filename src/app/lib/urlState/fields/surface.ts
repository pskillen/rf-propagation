import type { UrlStateFieldCodec } from '../codec.ts';

export const surfaceFieldCodec: UrlStateFieldCodec<'surface'> = {
  key: 'surface',
  encode(value, params) {
    if (value !== 'reach') params.set('s', value); // 'reach' is the default — omit for a shorter URL
  },
  decode(params, defaults) {
    const raw = params.get('s');
    return raw === 'path' || raw === 'timeline' || raw === 'explore' || raw === 'compare'
      ? raw
      : defaults.surface;
  },
};
