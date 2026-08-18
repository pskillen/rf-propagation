// Coverage-shading legend (F5.3, Slice 3) -- a static, always-visible
// panel ("the legend is doing teaching work; give it room" per
// ux-and-ia.md §4.1), listing the reliability scale and the named
// hop-count regions groundwave/skip zone/hop 1-4, in plain language
// without needing the reusable in-place term-definition mechanism
// (F8.4, phase 11 -- not built yet).
import { HOP_BAND_COLORS } from './cellFillStyle.ts';
import classes from './CoverageLegend.module.css';

const HOP_BAND_LABELS: Record<number, string> = {
  0: 'Groundwave',
  1: 'Hop 1',
  2: 'Hop 2',
  3: 'Hop 3',
  4: 'Hop 4',
};

export default function CoverageLegend() {
  return (
    <div className={classes.root} aria-label="Coverage shading legend">
      <p className={classes.title}>Coverage shading</p>

      <div className={classes.reliabilityRow}>
        <span className={classes.reliabilityGradient} aria-hidden />
        <span className={classes.reliabilityLabel}>
          Reliability: faint (poor) &rarr; solid (good)
        </span>
      </div>

      <ul className={classes.regionList}>
        {Object.entries(HOP_BAND_COLORS).map(([hopCount, color]) => (
          <li key={hopCount} className={classes.regionRow}>
            <span className={classes.swatch} style={{ backgroundColor: color }} aria-hidden />
            <span>{HOP_BAND_LABELS[Number(hopCount)]}</span>
          </li>
        ))}
        <li className={classes.regionRow}>
          <span className={classes.swatch} data-empty aria-hidden />
          <span>Skip zone -- no coverage here, checked and empty (not missing data)</span>
        </li>
      </ul>
    </div>
  );
}
