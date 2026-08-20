/**
 * Dash-pattern constants for the globe's `pathsData` -- reduced from
 * Codeplug Studio's `src/app/components/HfPropagationGlobe/
 * globePathDash.ts` (phase 9's plan file, "Reference-only source").
 *
 * DEVIATION, FLAGGED: the reference file keys its dash math on
 * `PropagationMode` (groundwave/skywave/nvis/absorbed/escaped), because
 * mk1's globe also drew traced rays. This repo has no `PropagationMode`
 * type surfaced to the app layer yet (`generateIllustrationRays` exists
 * in the engine, `src/core/domain/propagation/illustrationRays.ts`, but
 * no ray path is rendered anywhere until phase 11, Explore, per this
 * phase's own "does NOT do" list). Porting the reference file's full
 * mode-keyed table today would mean inventing `PropagationMode` typing
 * for dead code — the phase file's own suggestion to "port the whole
 * small file as-is" assumed that type already existed at this call site,
 * which it doesn't. This phase only draws the terminator, so this file
 * is reduced to just the terminator's fixed dash length/gap; phase 11
 * should restore the full mode-keyed table (and its own
 * `estimateGlobePathArcLength` helper) when it adds ray paths, rather
 * than assume this file already has that shape.
 */
export const TERMINATOR_DASH_LENGTH = 0.18;
export const TERMINATOR_DASH_GAP = 0.05;
