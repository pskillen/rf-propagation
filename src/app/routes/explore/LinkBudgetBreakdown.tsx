/**
 * The link-budget breakdown panel (F8.5, [#67]) — rendered within Explore
 * whenever a target and band are active (i.e. whenever there's a concrete
 * link budget to explain, arrived at via either door: the surface switch
 * or an `ExplainThisLink` click). Walks `buildLinkBudgetBreakdown`'s
 * output into a per-hop, per-loss-type table plus per-mode verdicts,
 * with `TermDefinition` on every jargon term it surfaces.
 *
 * [#67]: https://github.com/pskillen/rf-propagation/issues/67
 */
import { Panel } from '../../components/v2/index.ts';
import TermDefinition from '../../components/TermDefinition/TermDefinition.tsx';
import type { LinkBudgetBreakdown as LinkBudgetBreakdownData } from './buildBreakdownRows.ts';
import classes from './LinkBudgetBreakdown.module.css';

export interface LinkBudgetBreakdownProps {
  breakdown: LinkBudgetBreakdownData | null;
  /** `solveHopsForDistance` returned `{ kind: 'unreachable' }` -- no hop count/layer combination reaches this target at this frequency. */
  unreachable: boolean;
  frequencyMhz: number;
}

function formatDb(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} dB`;
}

export default function LinkBudgetBreakdown({
  breakdown,
  unreachable,
  frequencyMhz,
}: LinkBudgetBreakdownProps) {
  if (unreachable) {
    return (
      <Panel title="Link budget">
        <p className={classes.empty}>
          No hop count or reflecting layer reaches this target at {frequencyMhz} MHz right now.
        </p>
      </Panel>
    );
  }

  if (!breakdown) return null;

  return (
    <Panel
      title="Link budget"
      sub={`${breakdown.hopCount}-hop path via ${breakdown.reflectingLayers.join(', ')}`}
    >
      <table className={classes.table}>
        <thead>
          <tr>
            <th>Hop</th>
            <th>Layer</th>
            <th>
              <TermDefinition term="takeoffAngle">Takeoff angle</TermDefinition>
            </th>
            <th>Absorption</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.perHopAbsorption.map((row) => (
            <tr key={row.hopIndex}>
              <td>{row.hopIndex + 1}</td>
              <td>{row.layer}</td>
              <td>{row.takeoffAngleDeg.toFixed(1)}°</td>
              <td>{formatDb(row.absorptionDb)}</td>
            </tr>
          ))}
          <tr className={classes.totalRow}>
            <td colSpan={3}>Total absorption</td>
            <td>{formatDb(breakdown.totalAbsorptionDb)}</td>
          </tr>
        </tbody>
      </table>

      {breakdown.perBounceGroundReflection.length > 0 ? (
        <table className={classes.table}>
          <thead>
            <tr>
              <th>Ground bounce</th>
              <th>Loss</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.perBounceGroundReflection.map((row) => (
              <tr key={row.bounceIndex}>
                <td>{row.bounceIndex + 1}</td>
                <td>{formatDb(row.lossDb)}</td>
              </tr>
            ))}
            <tr className={classes.totalRow}>
              <td>Total ground reflection</td>
              <td>{formatDb(breakdown.totalGroundReflectionDb)}</td>
            </tr>
          </tbody>
        </table>
      ) : null}

      <table className={classes.table}>
        <tbody>
          <tr>
            <td>EIRP</td>
            <td>{breakdown.eirpDbm.toFixed(1)} dBm</td>
          </tr>
          <tr>
            <td>Spreading loss</td>
            <td>{breakdown.fsplDb.toFixed(1)} dB</td>
          </tr>
          <tr>
            <td>Polarisation</td>
            <td>{breakdown.polarisationDb.toFixed(1)} dB</td>
          </tr>
          <tr>
            <td>Received power</td>
            <td>{breakdown.receivedPowerDbm.toFixed(1)} dBm</td>
          </tr>
          <tr>
            <td>Noise floor</td>
            <td>{breakdown.noiseFloorDbm.toFixed(1)} dBm</td>
          </tr>
          <tr className={classes.totalRow}>
            <td>
              <TermDefinition term="snrMargin">SNR</TermDefinition>
            </td>
            <td>{formatDb(breakdown.snrDb2400)}</td>
          </tr>
          <tr>
            <td>
              <TermDefinition term="muf">MUF</TermDefinition>
            </td>
            <td>{breakdown.mufMhz.toFixed(1)} MHz</td>
          </tr>
        </tbody>
      </table>

      <table className={classes.table}>
        <thead>
          <tr>
            <th>Mode</th>
            <th>Margin</th>
            <th>
              <TermDefinition term="reliability">Reliability</TermDefinition>
            </th>
          </tr>
        </thead>
        <tbody>
          {breakdown.modeVerdicts.map((verdict) => (
            <tr key={verdict.mode}>
              <td>{verdict.mode.toUpperCase()}</td>
              <td>{formatDb(verdict.marginDb)}</td>
              <td className={classes[`bucket_${verdict.bucket}`]}>
                {Math.round(verdict.reliability * 100)}% ({verdict.bucket})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
