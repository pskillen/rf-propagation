// SVG line plot of the active antenna's elevation gain pattern (0°–90°) —
// makes "elevation pattern visibly changes with height" (F4.3) an
// observable UI behaviour, not just a passing unit test.
import { elevationGainDbi } from '@core/domain/antenna/antennaPattern';
import type { AntennaConfig } from '@core/domain/station/types';
import classes from './AntennaPatternPreview.module.css';

// Hardcoded reference frequency for this phase's preview — Conditions
// (phase 7) doesn't exist yet, so there's no "currently active band" to
// plot against. Once phase 7 lands, this preview should use the active
// band's own frequency instead.
const PREVIEW_REFERENCE_FREQUENCY_MHZ = 14;

const SVG_WIDTH = 280;
const SVG_HEIGHT = 140;
const PADDING = 20;
const ELEVATION_STEP_DEG = 2;

export interface AntennaPatternPreviewProps {
  antenna: AntennaConfig;
}

export default function AntennaPatternPreview({ antenna }: AntennaPatternPreviewProps) {
  const azimuthDeg = antenna.azimuthDeg ?? 0;

  const points: { elevationDeg: number; gainDbi: number }[] = [];
  for (let elevationDeg = 0; elevationDeg <= 90; elevationDeg += ELEVATION_STEP_DEG) {
    points.push({
      elevationDeg,
      gainDbi: elevationGainDbi(antenna, elevationDeg, azimuthDeg, PREVIEW_REFERENCE_FREQUENCY_MHZ),
    });
  }

  const gains = points.map((point) => point.gainDbi);
  const minGain = Math.min(...gains);
  const maxGain = Math.max(...gains);
  const gainRange = Math.max(maxGain - minGain, 1e-6);

  const plotWidth = SVG_WIDTH - PADDING * 2;
  const plotHeight = SVG_HEIGHT - PADDING * 2;

  const path = points
    .map((point, index) => {
      const x = PADDING + (point.elevationDeg / 90) * plotWidth;
      const y = PADDING + plotHeight - ((point.gainDbi - minGain) / gainRange) * plotHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className={classes.root}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className={classes.svg}
        role="img"
        aria-label={`Elevation gain pattern for ${antenna.name}, ${PREVIEW_REFERENCE_FREQUENCY_MHZ} megahertz`}
      >
        <line
          x1={PADDING}
          y1={PADDING + plotHeight}
          x2={PADDING + plotWidth}
          y2={PADDING + plotHeight}
          className={classes.axis}
        />
        <path d={path} className={classes.line} fill="none" />
      </svg>
      <p className={classes.caption}>
        Elevation gain at {PREVIEW_REFERENCE_FREQUENCY_MHZ} MHz, 0°–90° above horizon (azimuth{' '}
        {azimuthDeg}°)
      </p>
    </div>
  );
}
