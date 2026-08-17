/**
 * Physics validation harness — V1-V9 and V19 (physics-and-fidelity.md §6.4,
 * mk1-gap-analysis.md §5). This is the single control that would have
 * prevented mk1 shipping an engine that never reflects off F2. Every check
 * below is independently identifiable by its V-number in the test name, so
 * a future phase can say "V6 still passes" and mean something specific.
 *
 * This file gates CI from phase 2 onward (npm run test runs it by default).
 * Every later phase that touches the engine (3, 4, ...) must keep these
 * green and add new checks for any new physical claim it makes.
 *
 * V2/V4 numeric bound note: the phase plan states E-layer sec(phi) "never
 * exceeds 5.4" (V2) and a single E hop "never exceeds 2100 km" (V4). Its own
 * Slice 3 prose separately estimates E's sec(phi) cap as "~5.2". Computed
 * directly from the formulas this phase specifies (sin(phi) = Re*cos(Delta)/
 * (Re+h'), h'=110km), the true supremum as Delta -> 0 (grazing) is
 * sec(phi) ~= 5.4508 and ground range ~= 2350.95 km — both a little above
 * the plan's literal round numbers, and outside its own "~5.2" estimate too.
 * These are internally-inconsistent approximate figures in the plan, not a
 * precise target; V2/V4 below assert against the true geometric supremum
 * (with a small margin) rather than the plan's literal 5.4/2100, so the
 * checks assert the *shape* of the claim (E is tightly bounded, nowhere
 * near mk1's unbounded ~19x blowup) without being fragile to which rounded
 * figure the plan prose used. See PR description for this call.
 */
import { describe, expect, it } from 'vitest';
import {
  EARTH_RADIUS_KM,
  groundRangePerHopKm,
  halfHopCentralAngleRad,
  takeoffAngleForGroundRangeRad,
} from './geometry';
import { layerStates } from './layers';
import { mufFactor, selectReflectingLayer } from './reflection';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/** Delta sweep from grazing to near-vertical, inclusive of the true Delta=0 extreme. */
function sweepDeltaDeg(stepDeg = 0.25): number[] {
  const out: number[] = [];
  for (let d = 0; d < 90; d += stepDeg) out.push(d);
  out.push(89.999);
  return out;
}

describe('V1 — F2 MUF factor never exceeds 3.6 at any Delta >= 0deg', () => {
  it('holds across the full grazing-to-near-vertical sweep', () => {
    for (const deltaDeg of sweepDeltaDeg()) {
      const secPhi = mufFactor(deltaDeg * DEG_TO_RAD, 300);
      expect(secPhi).toBeLessThanOrEqual(3.6);
    }
  });
});

describe('V2 — E-layer MUF factor is tightly bounded (not mk1-unbounded)', () => {
  it('never exceeds 5.5 across the full grazing-to-near-vertical sweep', () => {
    // See file header: the plan's literal cap (5.4) and its own "~5.2"
    // estimate both undershoot the true geometric supremum (~5.4508 at
    // Delta=0); 5.5 is asserted here as a tight bound consistent with that
    // supremum, with a description of the discrepancy in this file's header.
    for (const deltaDeg of sweepDeltaDeg()) {
      const secPhi = mufFactor(deltaDeg * DEG_TO_RAD, 110);
      expect(secPhi).toBeLessThanOrEqual(5.5);
    }
  });

  it('is nowhere near mk1s unbounded 1/sin(Delta) blowup (~19x at Delta=3deg)', () => {
    const secPhi = mufFactor(3 * DEG_TO_RAD, 110);
    expect(secPhi).toBeLessThan(10);
  });
});

describe('V3 — a single F2 hop never exceeds 4000km ground range', () => {
  it('holds across the full grazing-to-near-vertical sweep', () => {
    for (const deltaDeg of sweepDeltaDeg()) {
      const rangeKm = groundRangePerHopKm(deltaDeg * DEG_TO_RAD, 300);
      expect(rangeKm).toBeLessThanOrEqual(4000);
    }
  });
});

describe('V4 — a single E hop is tightly bounded (not mk1-unbounded)', () => {
  it('never exceeds 2400km ground range across the full sweep', () => {
    // See file header: true geometric supremum at Delta=0 is ~2350.95km,
    // above the plan's literal 2100km; 2400km asserted here with margin.
    for (const deltaDeg of sweepDeltaDeg()) {
      const rangeKm = groundRangePerHopKm(deltaDeg * DEG_TO_RAD, 110);
      expect(rangeKm).toBeLessThanOrEqual(2400);
    }
  });
});

describe('V5 — Delta -> theta -> Delta round-trips to within 0.05deg across [1deg, 89deg]', () => {
  it('round-trips for F2 height (300km)', () => {
    for (let deltaDeg = 1; deltaDeg <= 89; deltaDeg += 1) {
      const deltaRad = deltaDeg * DEG_TO_RAD;
      const theta = halfHopCentralAngleRad(deltaRad, 300);
      const groundRangeKm = 2 * EARTH_RADIUS_KM * theta;
      const recoveredDeg = takeoffAngleForGroundRangeRad(groundRangeKm, 1, 300) * RAD_TO_DEG;
      expect(Math.abs(recoveredDeg - deltaDeg)).toBeLessThan(0.05);
    }
  });

  it('round-trips for E height (110km)', () => {
    for (let deltaDeg = 1; deltaDeg <= 89; deltaDeg += 1) {
      const deltaRad = deltaDeg * DEG_TO_RAD;
      const theta = halfHopCentralAngleRad(deltaRad, 110);
      const groundRangeKm = 2 * EARTH_RADIUS_KM * theta;
      const recoveredDeg = takeoffAngleForGroundRangeRad(groundRangeKm, 1, 110) * RAD_TO_DEG;
      expect(Math.abs(recoveredDeg - deltaDeg)).toBeLessThan(0.05);
    }
  });
});

describe('V6 — the D layer is never returned as a reflecting layer', () => {
  // mk1 regression check: mk1 shipped a model where flat identical layer
  // densities let the D layer (an absorber only) act as a reflector.
  // Per the ticket: do not delete this test as "redundant" with V7-V9 —
  // it exists specifically to catch that regression at the selection layer.
  it('holds across a sweep of frequency, angle, time-of-day, SFI and Kp', () => {
    const frequencies = [1, 3, 5, 7, 10, 14, 18, 21, 24, 28, 30, 50, 100];
    const takeoffAnglesDeg = [0.5, 1, 5, 15, 30, 45, 60, 75, 89];
    const solarZeniths = [0, 15, 30, 60, 75, 89, 90, 120, 170];
    const sfiValues = [70, 100, 120, 150, 220];
    const kpValues = [0, 3, 6, 9];

    for (const sfi of sfiValues) {
      for (const kp of kpValues) {
        for (const chi of solarZeniths) {
          const layers = layerStates(sfi, kp, chi, 60);
          for (const deltaDeg of takeoffAnglesDeg) {
            for (const f of frequencies) {
              const result = selectReflectingLayer(f, deltaDeg * DEG_TO_RAD, layers);
              if (result.kind === 'reflected') {
                expect(result.layer).not.toBe('D');
              }
            }
          }
        }
      }
    }
  });

  it('holds even when D is artificially given a very low (highly "reflective") critical frequency', () => {
    const layers = layerStates(120, 0, 0, 0).map((layer) =>
      layer.id === 'D' ? { ...layer, criticalFrequencyMhz: 0.1 } : layer,
    );
    for (const f of [0.5, 1, 3, 7, 14]) {
      const result = selectReflectingLayer(f, 45 * DEG_TO_RAD, layers);
      expect(result.kind === 'reflected' ? result.layer : null).not.toBe('D');
    }
  });
});

describe('V7 — the four layers have distinct critical frequencies for any daytime SFI', () => {
  it('E, F1, F2 are mutually distinct and D has null, across daytime SFI values', () => {
    for (const sfi of [70, 90, 110, 130, 150, 180, 220]) {
      const layers = layerStates(sfi, 0, 20, 0); // chi=20deg: daytime, F1 active
      const d = layers.find((l) => l.id === 'D')!;
      const e = layers.find((l) => l.id === 'E')!;
      const f1 = layers.find((l) => l.id === 'F1')!;
      const f2 = layers.find((l) => l.id === 'F2')!;

      expect(d.criticalFrequencyMhz).toBeNull();
      expect(e.criticalFrequencyMhz).not.toBeNull();
      expect(f1.criticalFrequencyMhz).not.toBeNull();
      expect(f2.criticalFrequencyMhz).not.toBeNull();

      expect(e.criticalFrequencyMhz).not.toBeCloseTo(f1.criticalFrequencyMhz!, 5);
      expect(f1.criticalFrequencyMhz).not.toBeCloseTo(f2.criticalFrequencyMhz!, 5);
      expect(e.criticalFrequencyMhz).not.toBeCloseTo(f2.criticalFrequencyMhz!, 5);
    }
  });
});

describe('V8 — at chi=0deg, SFI=120: foE ~= 3.9MHz, foF2 ~= 8.0MHz, foE < foF1 < foF2', () => {
  it('matches the worked check', () => {
    const layers = layerStates(120, 0, 0, 0);
    const e = layers.find((l) => l.id === 'E')!.criticalFrequencyMhz!;
    const f1 = layers.find((l) => l.id === 'F1')!.criticalFrequencyMhz!;
    const f2 = layers.find((l) => l.id === 'F2')!.criticalFrequencyMhz!;

    expect(e).toBeCloseTo(3.9, 1);
    expect(f2).toBeCloseTo(8.0, 1);
    expect(e).toBeLessThan(f1);
    expect(f1).toBeLessThan(f2);
  });
});

describe('V9 — at night, F1 and D are inactive and F2 is the only long-haul reflector', () => {
  it('D and F1 are null; E persists at its floor; F2 persists as the sole strong reflector', () => {
    const nightChiDeg = 130;
    const layers = layerStates(120, 0, nightChiDeg, 0);
    const d = layers.find((l) => l.id === 'D')!;
    const e = layers.find((l) => l.id === 'E')!;
    const f1 = layers.find((l) => l.id === 'F1')!;
    const f2 = layers.find((l) => l.id === 'F2')!;

    expect(d.criticalFrequencyMhz).toBeNull();
    expect(f1.criticalFrequencyMhz).toBeNull();
    expect(e.criticalFrequencyMhz).not.toBeNull();
    expect(f2.criticalFrequencyMhz).not.toBeNull();
    // F2 is the primary long-haul (highest-frequency-capable) reflector at night.
    expect(f2.criticalFrequencyMhz!).toBeGreaterThan(e.criticalFrequencyMhz!);
  });
});

describe('V19 — raising SFI never lowers MUF', () => {
  it('foE, foF1, foF2 are non-decreasing as SFI rises, holding chi/Kp/geomagLat fixed', () => {
    const sfiSeries = [70, 90, 110, 130, 150, 180, 220];
    for (const chiDeg of [0, 30, 60]) {
      let prevE = -Infinity;
      let prevF1 = -Infinity;
      let prevF2 = -Infinity;
      for (const sfi of sfiSeries) {
        const layers = layerStates(sfi, 0, chiDeg, 0);
        const e = layers.find((l) => l.id === 'E')!.criticalFrequencyMhz!;
        const f1 = layers.find((l) => l.id === 'F1')!.criticalFrequencyMhz;
        const f2 = layers.find((l) => l.id === 'F2')!.criticalFrequencyMhz!;

        expect(e).toBeGreaterThanOrEqual(prevE - 1e-9);
        if (f1 != null) expect(f1).toBeGreaterThanOrEqual(prevF1 - 1e-9);
        expect(f2).toBeGreaterThanOrEqual(prevF2 - 1e-9);

        prevE = e;
        if (f1 != null) prevF1 = f1;
        prevF2 = f2;
      }
    }
  });

  it('end-to-end MUF (mufFactor x foF2) is non-decreasing as SFI rises', () => {
    const deltaRad = 20 * DEG_TO_RAD;
    let prevMuf = -Infinity;
    for (const sfi of [70, 90, 110, 130, 150, 180, 220]) {
      const layers = layerStates(sfi, 0, 0, 0);
      const f2 = layers.find((l) => l.id === 'F2')!.criticalFrequencyMhz!;
      const muf = f2 * mufFactor(deltaRad, 300);
      expect(muf).toBeGreaterThanOrEqual(prevMuf - 1e-9);
      prevMuf = muf;
    }
  });
});
