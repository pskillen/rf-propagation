import { describe, expect, it } from 'vitest';
import {
  modeVerdict,
  pMuf,
  pSnr,
  reliability,
  reliabilityBucket,
  standardNormalCdf,
} from './reliability';

describe('standardNormalCdf', () => {
  it('matches known values', () => {
    expect(standardNormalCdf(0)).toBeCloseTo(0.5, 5);
    expect(standardNormalCdf(1.645)).toBeCloseTo(0.95, 3);
    expect(standardNormalCdf(-1.645)).toBeCloseTo(0.05, 3);
  });

  it('is monotonically increasing', () => {
    let prev = -Infinity;
    for (let x = -4; x <= 4; x += 0.5) {
      const value = standardNormalCdf(x);
      expect(value).toBeGreaterThanOrEqual(prev);
      prev = value;
    }
  });
});

describe('pMuf', () => {
  it('gives 50% when frequency equals MUF exactly', () => {
    expect(pMuf(14, 14)).toBeCloseTo(0.5, 5);
  });

  it('rises toward 1 as MUF rises well above frequency', () => {
    expect(pMuf(30, 14)).toBeGreaterThan(0.9);
  });

  it('falls toward 0 as frequency rises well above MUF', () => {
    expect(pMuf(14, 30)).toBeLessThan(0.1);
  });
});

describe('pSnr', () => {
  it('gives 50% at exactly zero margin', () => {
    expect(pSnr(0)).toBeCloseTo(0.5, 5);
  });

  it('rises with positive margin, falls with negative margin', () => {
    expect(pSnr(16)).toBeGreaterThan(0.9);
    expect(pSnr(-16)).toBeLessThan(0.1);
  });
});

describe('reliabilityBucket', () => {
  it('buckets at exactly the 30%/70% boundaries', () => {
    expect(reliabilityBucket(0.7)).toBe('good');
    expect(reliabilityBucket(0.6999)).toBe('marginal');
    expect(reliabilityBucket(0.3)).toBe('marginal');
    expect(reliabilityBucket(0.2999)).toBe('unlikely');
  });
});

describe('reliability', () => {
  it('is the product of the two probability terms', () => {
    expect(reliability(0.8, 0.5)).toBeCloseTo(0.4, 9);
  });
});

describe('modeVerdict', () => {
  it('assembles margin, reliability and bucket consistently', () => {
    const verdict = modeVerdict(14, 14, 20, 'ssb');
    expect(verdict.mode).toBe('ssb');
    expect(verdict.marginDb).toBeCloseTo(20 - 6, 9);
    expect(verdict.reliability).toBeCloseTo(reliability(pMuf(14, 14), pSnr(20 - 6)), 9);
    expect(verdict.bucket).toBe(reliabilityBucket(verdict.reliability));
  });

  it('never exposes a bare boolean reachable field', () => {
    const verdict = modeVerdict(14, 14, 20, 'ssb');
    for (const value of Object.values(verdict)) {
      expect(typeof value).not.toBe('boolean');
    }
  });
});
