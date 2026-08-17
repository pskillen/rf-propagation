export type SurfaceId = 'reach' | 'path' | 'timeline' | 'explore';

/**
 * Grows by one optional-in-spirit field per phase (phase 6 adds `station`,
 * phase 7 adds `conditions` and `bandId`, etc. — see ux-and-ia.md §6 for the
 * eventual full shape). Each addition is a new property on this interface
 * plus a new field-codec module registered in codec.ts's FIELD_CODECS array
 * — never a change to an existing property or an existing field-codec's logic.
 */
export interface ViewerUrlState {
  surface: SurfaceId;
}

export const URL_STATE_VERSION = 1;

export const DEFAULT_VIEWER_URL_STATE: ViewerUrlState = {
  surface: 'reach',
};
