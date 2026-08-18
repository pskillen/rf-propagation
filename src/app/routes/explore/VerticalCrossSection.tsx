/**
 * Vertical cross-section (F8.1, [#64]) — a labelled 2D side-on slice
 * through the ionosphere along the current bearing: D/E/F1/F2 as
 * background bands (only the ones `crossSectionLayerBands` says are
 * active), the station at the origin, the primary hop sequence as a
 * polyline, and (in Path mode, i.e. `target` set) a marker at the
 * target's true range.
 *
 * mk1's own cross-section had NO axis labels at all ("which made the
 * diagram decorative" — this phase's own plan file, quoting F8.1's
 * acceptance criteria) — both axes are drawn with tick labels here for
 * exactly that reason.
 *
 * [#64]: https://github.com/pskillen/rf-propagation/issues/64
 */
import type { LayerId } from '@core/domain/propagation/layers';
import { colorForLayer } from '@core/domain/propagation/layerColor';
import type { RayPoint } from '@core/domain/propagation/illustrationRays';
import type { CrossSectionLayerBand } from './crossSectionLayerBands.ts';
import classes from './VerticalCrossSection.module.css';

const VIEWBOX_WIDTH = 720;
const VIEWBOX_HEIGHT = 360;
const MARGIN_LEFT = 56;
const MARGIN_BOTTOM = 40;
const MARGIN_TOP = 16;
const MARGIN_RIGHT = 16;
const PLOT_WIDTH = VIEWBOX_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const PLOT_HEIGHT = VIEWBOX_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

/**
 * Altitude axis max (km) — comfortably above F2's night height (350km,
 * `layers.ts`) without the D/E region (90/110km) being crushed against
 * the x-axis at a linear scale.
 */
const MAX_ALTITUDE_KM = 420;

/**
 * Rendering judgment call, flagged: a sqrt altitude scale (not linear, not
 * log) — linear crushes D/E into a sliver below F2's band; log over-expands
 * the low end and makes F2's own band look disproportionately thin by
 * comparison. sqrt is a reasonable middle ground that keeps D (90km)
 * visually distinct from E (110km) while still leaving F2 (300-350km)
 * comfortably legible.
 */
function altitudeToY(altitudeKm: number): number {
  const clamped = Math.max(0, Math.min(MAX_ALTITUDE_KM, altitudeKm));
  const fraction = Math.sqrt(clamped / MAX_ALTITUDE_KM);
  return MARGIN_TOP + PLOT_HEIGHT * (1 - fraction);
}

function distanceToX(distanceKm: number, maxRangeKm: number): number {
  const fraction = maxRangeKm > 0 ? Math.max(0, Math.min(1, distanceKm / maxRangeKm)) : 0;
  return MARGIN_LEFT + PLOT_WIDTH * fraction;
}

const ALTITUDE_TICKS_KM = [0, 90, 200, 300, 420];

function rangeTicksKm(maxRangeKm: number): number[] {
  const step = maxRangeKm / 4;
  return Array.from({ length: 5 }, (_, i) => Math.round(i * step));
}

export interface VerticalCrossSectionProps {
  bands: CrossSectionLayerBand[];
  /** Ground distance (km) the plot's x-axis spans — the current band/target's reach, or a sensible default. */
  maxRangeKm: number;
  /** The primary hop sequence's polyline (Slice 2 already computed this ray; reused here rather than re-requesting one). */
  primaryRayPoints: RayPoint[];
  /** Target's true range (km) along the bearing, when a target is set (Path mode, FR-18). */
  targetRangeKm?: number | null;
  bearingDeg: number;
  soloLayerId?: LayerId;
}

export default function VerticalCrossSection({
  bands,
  maxRangeKm,
  primaryRayPoints,
  targetRangeKm,
  bearingDeg,
  soloLayerId,
}: VerticalCrossSectionProps) {
  const safeMaxRangeKm = Math.max(1, maxRangeKm);
  const rangeTicks = rangeTicksKm(safeMaxRangeKm);

  const rayPath = primaryRayPoints
    .map((p, i) => {
      const x = distanceToX(p.distanceAlongBearingKm, safeMaxRangeKm);
      const y = altitudeToY(p.altitudeKm);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <figure
      className={classes.root}
      aria-label={`Vertical cross-section along bearing ${Math.round(bearingDeg)} degrees`}
    >
      <svg viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} className={classes.svg} role="img">
        {/* Layer bands */}
        {bands.map((band) => {
          const y = altitudeToY(band.heightKm);
          const dimmed = soloLayerId != null && soloLayerId !== band.layer;
          return (
            <g key={band.layer} opacity={dimmed ? 0.15 : 0.85}>
              <rect
                x={MARGIN_LEFT}
                y={MARGIN_TOP}
                width={PLOT_WIDTH}
                height={Math.max(0, y - MARGIN_TOP)}
                fill={colorForLayer(band.layer)}
                fillOpacity={0.08}
              />
              <line
                x1={MARGIN_LEFT}
                x2={MARGIN_LEFT + PLOT_WIDTH}
                y1={y}
                y2={y}
                stroke={colorForLayer(band.layer)}
                strokeWidth={2}
              />
              <text
                x={MARGIN_LEFT + PLOT_WIDTH - 4}
                y={y - 4}
                textAnchor="end"
                className={classes.layerLabel}
              >
                {band.layer}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line
          x1={MARGIN_LEFT}
          x2={MARGIN_LEFT}
          y1={MARGIN_TOP}
          y2={MARGIN_TOP + PLOT_HEIGHT}
          className={classes.axisLine}
        />
        <line
          x1={MARGIN_LEFT}
          x2={MARGIN_LEFT + PLOT_WIDTH}
          y1={MARGIN_TOP + PLOT_HEIGHT}
          y2={MARGIN_TOP + PLOT_HEIGHT}
          className={classes.axisLine}
        />
        {ALTITUDE_TICKS_KM.map((km) => (
          <text
            key={km}
            x={MARGIN_LEFT - 8}
            y={altitudeToY(km) + 4}
            textAnchor="end"
            className={classes.tickLabel}
          >
            {km}
          </text>
        ))}
        {rangeTicks.map((km) => (
          <text
            key={km}
            x={distanceToX(km, safeMaxRangeKm)}
            y={MARGIN_TOP + PLOT_HEIGHT + 16}
            textAnchor="middle"
            className={classes.tickLabel}
          >
            {km.toLocaleString()}
          </text>
        ))}
        <text
          x={MARGIN_LEFT - 44}
          y={MARGIN_TOP + PLOT_HEIGHT / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${MARGIN_LEFT - 44} ${MARGIN_TOP + PLOT_HEIGHT / 2})`}
          className={classes.axisTitle}
        >
          Altitude (km)
        </text>
        <text
          x={MARGIN_LEFT + PLOT_WIDTH / 2}
          y={VIEWBOX_HEIGHT - 4}
          textAnchor="middle"
          className={classes.axisTitle}
        >
          Ground distance (km)
        </text>

        {/* Station marker */}
        <circle
          cx={MARGIN_LEFT}
          cy={MARGIN_TOP + PLOT_HEIGHT}
          r={5}
          className={classes.stationMarker}
        />

        {/* Primary hop polyline */}
        {primaryRayPoints.length > 1 ? (
          <path d={rayPath} className={classes.rayPath} fill="none" />
        ) : null}

        {/* Target marker (Path mode, FR-18) */}
        {targetRangeKm != null ? (
          <line
            data-testid="target-marker"
            x1={distanceToX(targetRangeKm, safeMaxRangeKm)}
            x2={distanceToX(targetRangeKm, safeMaxRangeKm)}
            y1={MARGIN_TOP}
            y2={MARGIN_TOP + PLOT_HEIGHT}
            className={classes.targetLine}
          />
        ) : null}
      </svg>
      <figcaption className={classes.caption}>
        Takeoff angle and reflecting layer drive the hop&apos;s shape shown above — see the ray
        legend for outcome colours.
      </figcaption>
    </figure>
  );
}
