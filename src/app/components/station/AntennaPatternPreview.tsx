// Three polar-plot cuts of the active (or in-progress draft, Slice 3)
// antenna's gain pattern (F4.3) -- REPLACES Slice 1-era phase 6's single
// elevation-only line chart (fix/reach-directionality-antenna-greyline,
// Slice 4): a beam's forward lobe / back-lobe stub and a dipole's
// figure-eight were invisible anywhere in the app until now, per
// feature-description.md §3.1's own description of what the shading
// should look like -- Slice 1 made that true on the Reach map; this slice
// makes it visible here too.
//
// Two elevation cuts (E-plane/H-plane style, 180deg half-circles, front
// lobe on one side meeting the back lobe at zenith) plus one azimuth cut
// (360deg, at whichever elevation the antenna is actually strongest --
// `peakGainElevationDeg`, exported by antennaPattern.ts but unused
// anywhere until this slice). A full 3D pattern viewer is the natural
// next step after this -- named here as the eventual destination, out of
// scope for this slice; three 2D cuts are the intentionally smaller v1.
import { elevationGainDbi, peakGainElevationDeg } from '@core/domain/antenna/antennaPattern';
import type { AntennaConfig } from '@core/domain/station/types';
import classes from './AntennaPatternPreview.module.css';

// Hardcoded reference frequency for this preview -- Conditions' own active
// band isn't threaded in here (same simplification phase 6 shipped with;
// this slice doesn't revisit it, see the plan file's own scoping).
const PREVIEW_REFERENCE_FREQUENCY_MHZ = 14;

const POLAR_SIZE = 160;
const POLAR_PADDING = 16;
const POLAR_RADIUS = POLAR_SIZE / 2 - POLAR_PADDING;
/** Half-circle plots are shorter than they are wide -- horizon-to-horizon along the bottom edge, zenith at the top. */
const HALF_SVG_HEIGHT = POLAR_RADIUS + POLAR_PADDING * 2;
const HALF_CENTER_Y = HALF_SVG_HEIGHT - POLAR_PADDING;
const FULL_CENTER = POLAR_SIZE / 2;

const ELEVATION_STEP_DEG = 2;
const AZIMUTH_STEP_DEG = 5;

export interface AntennaPatternPreviewProps {
  antenna: AntennaConfig;
}

export interface PolarCutPoint {
  /**
   * Compass-style plot angle: 0deg is straight up, increasing clockwise.
   * For an elevation cut this already encodes BOTH which 90deg half-circle
   * side (front/back) the sample is on AND how far from the horizon it
   * is -- see `buildElevationCutPoints`'s own doc. For an azimuth cut it's
   * literally the swept `phiDeg`.
   */
  angleDeg: number;
  gainDbi: number;
}

/**
 * Compass-to-Cartesian: `angleDeg=0` is straight up (SVG y grows downward,
 * so "up" is `cy - radius`), increasing clockwise -- the same convention
 * a bearing/azimuth already uses elsewhere in this app (`greatCircle.ts`),
 * reused here so an azimuth cut's plot orientation matches how azimuth is
 * described everywhere else.
 */
function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + radius * Math.sin(angleRad), y: cy - radius * Math.cos(angleRad) };
}

/**
 * Scales one gain value to a plot radius given an explicit (min, max)
 * range -- deliberately NOT derived from the point array being plotted
 * (see `AntennaPatternPreview`'s own call site): all three cuts share ONE
 * (min, max) pair so radii are comparable ACROSS plots, not just within
 * one. This is what makes an omnidirectional antenna's azimuth cut come
 * out as a full-radius circle (its one constant gain value equals the
 * antenna's own overall peak, found on the elevation cuts) rather than
 * collapsing to a point the way a naive per-cut min/max would -- and,
 * symmetrically, what makes a dipole's perpendicular-cut null (a
 * genuinely different, much lower value than anything on its parallel
 * cut) collapse toward the centre instead of always filling the frame.
 * A near-zero shared range (a degenerate antenna with no gain variation
 * anywhere) falls back to a mid-radius circle rather than dividing by ~0.
 */
function scaleGainToRadius(
  gainDbi: number,
  minGainDbi: number,
  maxGainDbi: number,
  maxRadius: number,
): number {
  const range = maxGainDbi - minGainDbi;
  if (range < 1e-6) return maxRadius / 2;
  return ((gainDbi - minGainDbi) / range) * maxRadius;
}

/**
 * One 180deg elevation cut -- front lobe (`phiFrontDeg`, theta 0deg->90deg)
 * and back lobe (`phiBackDeg`, theta 90deg->0deg) plotted as ONE continuous
 * arc meeting at zenith, horizon at each end. `phiFrontDeg`/`phiBackDeg`
 * are usually 180deg apart (an antenna's boresight and its reciprocal).
 * Angle convention: front spans compass 270deg (left horizon, theta=0deg)
 * through 360deg/0deg (zenith, theta=90deg); back continues from 90deg
 * (right horizon, theta=0deg) back down to 0deg (zenith, theta=90deg) --
 * so the path always reads left-horizon -> zenith -> right-horizon.
 */
export function buildElevationCutPoints(
  antenna: AntennaConfig,
  phiFrontDeg: number,
  phiBackDeg: number,
  frequencyMhz: number,
): PolarCutPoint[] {
  const front: PolarCutPoint[] = [];
  for (let thetaDeg = 0; thetaDeg <= 90; thetaDeg += ELEVATION_STEP_DEG) {
    front.push({
      angleDeg: 270 + thetaDeg,
      gainDbi: elevationGainDbi(antenna, thetaDeg, phiFrontDeg, frequencyMhz),
    });
  }
  const back: PolarCutPoint[] = [];
  for (let thetaDeg = 90; thetaDeg >= 0; thetaDeg -= ELEVATION_STEP_DEG) {
    back.push({
      angleDeg: 90 - thetaDeg,
      gainDbi: elevationGainDbi(antenna, thetaDeg, phiBackDeg, frequencyMhz),
    });
  }
  return [...front, ...back];
}

/** One 360deg azimuth cut at a fixed elevation -- `angleDeg` is literally the swept `phiDeg`. */
export function buildAzimuthCutPoints(
  antenna: AntennaConfig,
  elevationDeg: number,
  frequencyMhz: number,
): PolarCutPoint[] {
  const points: PolarCutPoint[] = [];
  for (let phiDeg = 0; phiDeg <= 360; phiDeg += AZIMUTH_STEP_DEG) {
    points.push({
      angleDeg: phiDeg,
      gainDbi: elevationGainDbi(antenna, elevationDeg, phiDeg, frequencyMhz),
    });
  }
  return points;
}

function buildPolarPath(
  points: PolarCutPoint[],
  cx: number,
  cy: number,
  minGainDbi: number,
  maxGainDbi: number,
): string {
  return points
    .map((point, index) => {
      const radius = scaleGainToRadius(point.gainDbi, minGainDbi, maxGainDbi, POLAR_RADIUS);
      const { x, y } = polarPoint(cx, cy, radius, point.angleDeg);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function AntennaPatternPreview({ antenna }: AntennaPatternPreviewProps) {
  const frequencyMhz = PREVIEW_REFERENCE_FREQUENCY_MHZ;
  const phi0 = antenna.azimuthDeg ?? 0;

  const parallelPoints = buildElevationCutPoints(antenna, phi0, phi0 + 180, frequencyMhz);
  const perpendicularPoints = buildElevationCutPoints(antenna, phi0 + 90, phi0 + 270, frequencyMhz);
  const peakElevationDeg = peakGainElevationDeg(antenna, phi0, frequencyMhz);
  const azimuthPoints = buildAzimuthCutPoints(antenna, peakElevationDeg, frequencyMhz);

  // One shared (min, max) across all three cuts -- see scaleGainToRadius's
  // own doc for why a per-cut-independent scale would be wrong here.
  const allGains = [...parallelPoints, ...perpendicularPoints, ...azimuthPoints].map(
    (point) => point.gainDbi,
  );
  const minGainDbi = Math.min(...allGains);
  const maxGainDbi = Math.max(...allGains);

  const parallelPath = buildPolarPath(
    parallelPoints,
    FULL_CENTER,
    HALF_CENTER_Y,
    minGainDbi,
    maxGainDbi,
  );
  const perpendicularPath = buildPolarPath(
    perpendicularPoints,
    FULL_CENTER,
    HALF_CENTER_Y,
    minGainDbi,
    maxGainDbi,
  );
  const azimuthPath = buildPolarPath(
    azimuthPoints,
    FULL_CENTER,
    FULL_CENTER,
    minGainDbi,
    maxGainDbi,
  );

  return (
    <div className={classes.root}>
      <div className={classes.panels}>
        <div className={classes.panel}>
          <svg
            viewBox={`0 0 ${POLAR_SIZE} ${HALF_SVG_HEIGHT}`}
            className={classes.svg}
            role="img"
            aria-label={`Elevation gain pattern (parallel cut) for ${antenna.name}, ${frequencyMhz} megahertz`}
          >
            <line
              x1={FULL_CENTER - POLAR_RADIUS}
              y1={HALF_CENTER_Y}
              x2={FULL_CENTER + POLAR_RADIUS}
              y2={HALF_CENTER_Y}
              className={classes.axis}
            />
            <path d={parallelPath} className={classes.line} fill="none" />
          </svg>
          <p className={classes.caption}>Elevation -- parallel cut (boresight)</p>
        </div>

        <div className={classes.panel}>
          <svg
            viewBox={`0 0 ${POLAR_SIZE} ${HALF_SVG_HEIGHT}`}
            className={classes.svg}
            role="img"
            aria-label={`Elevation gain pattern (perpendicular cut) for ${antenna.name}, ${frequencyMhz} megahertz`}
          >
            <line
              x1={FULL_CENTER - POLAR_RADIUS}
              y1={HALF_CENTER_Y}
              x2={FULL_CENTER + POLAR_RADIUS}
              y2={HALF_CENTER_Y}
              className={classes.axis}
            />
            <path d={perpendicularPath} className={classes.line} fill="none" />
          </svg>
          <p className={classes.caption}>Elevation -- perpendicular cut (broadside)</p>
        </div>

        <div className={classes.panel}>
          <svg
            viewBox={`0 0 ${POLAR_SIZE} ${POLAR_SIZE}`}
            className={classes.svg}
            role="img"
            aria-label={`Azimuth gain pattern for ${antenna.name} at ${peakElevationDeg} degrees elevation, ${frequencyMhz} megahertz`}
          >
            <circle
              cx={FULL_CENTER}
              cy={FULL_CENTER}
              r={POLAR_RADIUS}
              className={classes.axis}
              fill="none"
            />
            <path d={azimuthPath} className={classes.line} fill="none" />
          </svg>
          <p className={classes.caption}>Azimuth -- at {peakElevationDeg}° elevation</p>
        </div>
      </div>
      <p className={classes.caption}>
        {frequencyMhz} MHz pattern preview. A full 3D pattern viewer is a natural next step, out of
        scope here.
      </p>
    </div>
  );
}
