/**
 * Assembles Slices 1-5 into one link budget call, given a KNOWN hop
 * sequence (takeoff angle, reflecting layer, ground range per hop — from
 * phase 2's geometry, for a GIVEN hop count). Does not search for the best
 * hop count (F2.11, phase 4) and does not select which layer reflects
 * (reflection.ts, phase 2) — both are given inputs here.
 */

import { incidenceAngleRad } from './geometry';
import type { LayerId } from './layers';
import {
  freeSpaceSpreadingLossDb,
  groundReflectionLossDb,
  ionosphericAbsorptionDbPerHop,
  POLARISATION_LOSS_DB,
  type GroundType,
} from './losses';
import { noiseFloorDbm, type NoiseEnvironment } from './noise';

/** D-region absorbing-region height (km) — see layers.ts's layer table. */
const D_LAYER_HEIGHT_KM = 90;

/**
 * One hop of a known, already-solved propagation path.
 *
 * `mufMhz` is NOT part of the phase-3 plan file's literal Hop interface as
 * written, but was added here because `LinkBudgetResult.mufMhz` is
 * specified as "the weakest-link hop's MUF" and there is no other way to
 * derive a layer's critical frequency from the plan's originally-stated
 * Hop fields (takeoffAngleRad/layer/virtualHeightKm alone give the MUF
 * *factor*, sec(phi), not the MUF itself — that also needs the layer's
 * critical frequency). Callers already have this value for free: this
 * phase's own V10-V18 instructions say to "construct each scenario's hops
 * via phase 2's geometry + Slice-3's reflection selection", and
 * `selectReflectingLayer` already returns `mufMhz` on its `ReflectionResult`
 * when `kind: 'reflected'`. This is a strictly-additive field (no existing
 * field changed or removed) — see the PR description's "Deviations"
 * section, since phase 4 depends on this exact shape.
 */
export interface Hop {
  takeoffAngleRad: number;
  layer: LayerId;
  virtualHeightKm: number;
  groundRangeKm: number;
  /**
   * Full hop slant distance (up-leg + down-leg) — construct as
   * `2 * slantPathLengthKm(takeoffAngleRad, virtualHeightKm)` from phase 2's
   * geometry module (which returns one half-hop only), matching
   * `groundRangeKm`'s full-hop convention (`groundRangePerHopKm`).
   */
  slantPathKm: number;
  solarZenithAtMidpointDeg: number;
  /** MUF (MHz) at this hop's reflecting layer and geometry — fo x sec(phi). */
  mufMhz: number;
}

export interface LinkBudgetInput {
  /** Known hop sequence — phase 4 searches hop counts, this doesn't. */
  hops: Hop[];
  frequencyMhz: number;
  txPowerW: number;
  txAntennaGainDbi: number;
  /**
   * Symmetric reference receiver: the model assumes a receive station with
   * the same antenna gain as TX (physics-and-fidelity.md §4.3). A real
   * antenna-pattern lookup arrives in phase 6 (F4.3) — this is a plain
   * number until then.
   */
  rxAntennaGainDbi: number;
  groundType: GroundType;
  noiseEnvironment: NoiseEnvironment;
  ssn: number;
  /** Receiver bandwidth (Hz) — 2400 for the standard mode set. */
  bandwidthHz: number;
}

export interface LinkBudgetResult {
  eirpDbm: number;
  fsplDb: number;
  absorptionDb: number;
  groundReflectionDb: number;
  polarisationDb: number;
  receivedPowerDbm: number;
  noiseFloorDbm: number;
  snrDb2400: number;
  /** From the weakest-link hop's MUF, for reliability's P_muf term. */
  mufMhz: number;
}

/**
 * Computes the full link budget for a known hop sequence: EIRP, spreading
 * loss, D-layer absorption, ground/polarisation loss, received power, noise
 * floor and SNR (at the input bandwidth).
 */
export function computeLinkBudget(input: LinkBudgetInput): LinkBudgetResult {
  const totalSlantPathKm = input.hops.reduce((sum, hop) => sum + hop.slantPathKm, 0);
  const fsplDb = freeSpaceSpreadingLossDb(totalSlantPathKm, input.frequencyMhz);

  const absorptionDb = input.hops.reduce((sum, hop) => {
    const incidenceAngleAtDLayerRad = incidenceAngleRad(hop.takeoffAngleRad, D_LAYER_HEIGHT_KM);
    return (
      sum +
      ionosphericAbsorptionDbPerHop(
        incidenceAngleAtDLayerRad,
        input.ssn,
        hop.solarZenithAtMidpointDeg,
        input.frequencyMhz,
      )
    );
  }, 0);

  const intermediateBounceCount = Math.max(0, input.hops.length - 1);
  const groundReflectionDb = groundReflectionLossDb(input.groundType, intermediateBounceCount);
  const polarisationDb = POLARISATION_LOSS_DB;

  const eirpDbm = 10 * Math.log10(input.txPowerW * 1000) + input.txAntennaGainDbi;
  const receivedPowerDbm =
    eirpDbm - fsplDb - absorptionDb - groundReflectionDb - polarisationDb + input.rxAntennaGainDbi;

  const noiseFloorDbmValue = noiseFloorDbm(
    input.frequencyMhz,
    input.noiseEnvironment,
    input.bandwidthHz,
  );
  const snrDb2400 = receivedPowerDbm - noiseFloorDbmValue;

  const mufMhz = Math.min(...input.hops.map((hop) => hop.mufMhz));

  return {
    eirpDbm,
    fsplDb,
    absorptionDb,
    groundReflectionDb,
    polarisationDb,
    receivedPowerDbm,
    noiseFloorDbm: noiseFloorDbmValue,
    snrDb2400,
    mufMhz,
  };
}
