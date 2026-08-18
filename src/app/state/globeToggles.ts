/**
 * `ViewerState.display.globeToggles` (F6.2, phase 9's Slice 2) — the
 * globe's Display-panel settings. Field names are this phase's own call
 * (flagged in the plan file: "the exact `display.globeToggles` field
 * names are this phase's own call... a later phase... should read them
 * from the actual repo rather than assuming the names sketched in
 * [the plan] file").
 */
export interface GlobeToggles {
  /** 1x (true scale, a no-op) to 10x. */
  exaggerationFactor: number;
  explodeEnabled: boolean;
  fresnelEnabled: boolean;
  /** Dashed greyline ring + sun marker. Night-side shade stays on regardless, whenever Conditions has an instant. */
  terminatorEnabled: boolean;
  cutawayEnabled: boolean;
  /** Slice 5 (F6.5) — Reach's map/globe view switch. Lives here (not a separate top-level field) per this phase's own field-naming call. */
  mapMode: 'map' | 'globe';
}

export const MIN_EXAGGERATION_FACTOR = 1;
export const MAX_EXAGGERATION_FACTOR = 10;

/**
 * True-scale-ish defaults with Fresnel on (reads best against the blue
 * marble texture without exaggeration muddying the picture on first
 * load) — mirrors Codeplug Studio's own page-level defaults
 * (`exaggerationFactor: 2.5`, `fresnelEnabled: true`), everything else
 * off. `mapMode: 'map'` — map-first, globe is opt-in (F6.1's "lazy-loaded
 * so map-first surfaces don't carry the three.js bundle" AC).
 */
export const DEFAULT_GLOBE_TOGGLES: GlobeToggles = {
  exaggerationFactor: 2.5,
  explodeEnabled: false,
  fresnelEnabled: true,
  terminatorEnabled: false,
  cutawayEnabled: false,
  mapMode: 'map',
};
