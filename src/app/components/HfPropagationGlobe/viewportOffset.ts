/**
 * Viewport offset (F6.4, Slice 4) — closes out mk1 tranche-2's H1
 * carryover requirement (see this phase's plan file). No implementation
 * ever shipped for it in mk1 (tranche-2 never executed), so this phase
 * has to invent the mechanism, not just port one.
 *
 * **Judgment call, flagged — shift DIRECTION:** the plan file's own
 * illustration ("shifted left, giving the right-hand control panel room")
 * describes Codeplug Studio's own page layout, where the Display/control
 * panel sits on the RIGHT of a full-bleed canvas. This app's
 * `SurfaceLayout` (`src/app/components/layout/SurfaceLayout.tsx`) puts
 * Reach's control panel on the LEFT instead (a fixed-width grid column,
 * `.canvas` is the separate column to its right — see
 * `SurfaceLayout.module.css`), so this phase mirrors the shift direction
 * to match: the globe's apparent centre shifts RIGHT within its own
 * canvas, away from the shared boundary with the panel, not left. The
 * underlying intent (keep the station's hemisphere comfortably clear of
 * the panel-adjacent edge) is the same; only the sign flips for this
 * app's actual layout.
 */
import * as THREE from 'three';

/** Matches `SurfaceLayout.module.css`'s fixed left grid column (`340px`). */
export const CONTROL_PANEL_WIDTH_PX = 340;

/**
 * Matches `breakpoints.ts`'s `MOBILE_MAX_WIDTH_MEDIA_QUERY` (`48em` = `768px`
 * at the standard root font size) — the same breakpoint `SurfaceLayout`
 * itself collapses to a stacked mobile sheet at, and this phase's own
 * Slice 5 default-to-map breakpoint (see `globeToggles.ts`/`ReachPage.tsx`).
 * Below it, the control panel sits ABOVE the canvas, not beside it — no
 * shared side boundary to make room for, so the offset degrades to 0.
 */
export const VIEWPORT_OFFSET_BREAKPOINT_PX = 768;

/**
 * How far (px, same units as the container's own measured width) to
 * shift the globe's apparent centre within its canvas. Pure so the
 * degrade-at-mobile-width and clamp behaviour are directly testable
 * without a WebGL camera. Holds across resizes by design — callers
 * recompute this on every `ResizeObserver` tick, same as `size` itself.
 */
export function computeViewportOffsetPx(containerWidthPx: number): number {
  if (!Number.isFinite(containerWidthPx) || containerWidthPx < VIEWPORT_OFFSET_BREAKPOINT_PX) {
    return 0;
  }
  const desiredShiftPx = CONTROL_PANEL_WIDTH_PX / 2;
  // Clamped to at most a third of the container -- a runaway shift on a
  // narrow-but-still-desktop-width window must never push the globe
  // mostly off-canvas.
  return Math.min(desiredShiftPx, containerWidthPx / 3);
}

/**
 * Applies (or clears) the computed offset on the globe's underlying
 * `THREE.PerspectiveCamera` via `setViewOffset` — the standard Three.js
 * technique for shifting a camera's visible frustum without distorting
 * the projection (unlike a CSS transform on the canvas, which would crop
 * rather than re-project). A `shiftPx` of `0` clears any previous offset
 * rather than calling `setViewOffset(w, h, 0, 0, w, h)`, which is
 * numerically a no-op but leaves Three's internal "view is offset" flag
 * set.
 */
export function applyViewportOffset(
  camera: THREE.PerspectiveCamera,
  widthPx: number,
  heightPx: number,
  shiftPx: number,
): void {
  if (widthPx <= 0 || heightPx <= 0) return;
  if (shiftPx <= 0) {
    camera.clearViewOffset();
    return;
  }
  // Sub-window starts at the virtual frame's own left edge (x=0) and is
  // narrower than the wider virtual frame (fullWidth = width + 2*shift) --
  // the true optical centre (at fullWidth/2) then lands `shiftPx` to the
  // RIGHT of the visible sub-window's own natural centre.
  camera.setViewOffset(widthPx + 2 * shiftPx, heightPx, 0, 0, widthPx, heightPx);
}
