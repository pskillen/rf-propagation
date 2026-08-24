/**
 * Geometry summary and antenna angle check (F10.3, [#71]) — hop count,
 * reflecting layer, required takeoff angle from the selected verdict
 * row's `HopSolution`, plus "does the active antenna actually radiate at
 * that angle" via `computeAngleShortfall` against the real
 * `elevationGainDbi` lookup (F4.3, phase 6). Renders the shortfall in
 * plain language (ux-and-ia.md §4.2's own worked example: "20m needs 8°;
 * your dipole at 6 m puts −9 dB there"), not just a number.
 *
 * "Links to Compare so a different antenna is one interaction away" —
 * this slice is a CONSUMER of phase 12's `ViewerState.compare` shape and
 * `/compare` route, not a builder of either (Compare precedes this phase
 * in the stack).
 *
 * [#71]: https://github.com/pskillen/rf-propagation/issues/71
 */
import { useNavigate } from 'react-router-dom';
import { elevationGainDbi } from '@core/domain/antenna/antennaPattern';
import type { HopSolution } from '@core/domain/propagation/multiHop';
import type { AntennaConfig, Station } from '@core/domain/station/types';
import { Button } from '../../components/v2/index.ts';
import TermDefinition from '../../components/TermDefinition/TermDefinition.tsx';
import { useViewerState } from '../../state/viewerState.tsx';
import { computeAngleShortfall } from './geometrySummary.ts';
import classes from './GeometrySummary.module.css';

export interface GeometrySummaryProps {
  hopSolution: HopSolution;
  station: Station;
  activeAntenna: AntennaConfig;
  bearingDeg: number;
  frequencyMhz: number;
}

export default function GeometrySummary({
  hopSolution,
  station,
  activeAntenna,
  bearingDeg,
  frequencyMhz,
}: GeometrySummaryProps) {
  const { setState } = useViewerState();
  const navigate = useNavigate();

  // All hops share the same takeoff angle under this model's equal-hop
  // assumption (phase 4's Slice 1) -- display one value, not a per-hop list.
  const takeoffAngleDeg = (hopSolution.hops[0]!.takeoffAngleRad * 180) / Math.PI;
  const shortfall = computeAngleShortfall(takeoffAngleDeg, (elevationDeg) =>
    elevationGainDbi(activeAntenna, elevationDeg, bearingDeg, frequencyMhz),
  );

  const differentAntenna = station.antennas.find((antenna) => antenna.id !== activeAntenna.id);

  function handleCompareWithDifferentAntenna() {
    if (!differentAntenna) return;
    setState((prev) => ({
      ...prev,
      compare: {
        enabled: true,
        againstAntennaId: differentAntenna.id,
        againstBandId: undefined,
        againstAtMs: undefined,
      },
    }));
    navigate('/compare');
  }

  return (
    <div className={classes.root} aria-label="Geometry summary">
      <p className={classes.line}>
        <strong>{hopSolution.hopCount}</strong>-hop path via the{' '}
        <strong>{hopSolution.layer}</strong> layer, requiring a{' '}
        <TermDefinition term="takeoffAngle">takeoff angle</TermDefinition> of{' '}
        <strong>{takeoffAngleDeg.toFixed(1)}°</strong>.
      </p>
      {shortfall.flagged ? (
        <p className={classes.shortfall}>
          {activeAntenna.name} at {activeAntenna.heightM} m puts {shortfall.shortfallDb.toFixed(1)}{' '}
          dB less gain at {takeoffAngleDeg.toFixed(0)}° than its own peak (
          {shortfall.peakElevationDeg}°) — the link budget above may be more optimistic than what
          this antenna actually radiates that way.
        </p>
      ) : (
        <p className={classes.ok}>
          {activeAntenna.name} radiates close to its own peak gain at {takeoffAngleDeg.toFixed(0)}°
          ({shortfall.shortfallDb.toFixed(1)} dB below peak).
        </p>
      )}
      {differentAntenna ? (
        <Button variant="secondary" size="sm" onClick={handleCompareWithDifferentAntenna}>
          Compare with {differentAntenna.name}
        </Button>
      ) : null}
    </div>
  );
}
