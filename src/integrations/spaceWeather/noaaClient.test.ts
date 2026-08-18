import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLatestSpaceWeather } from './noaaClient.ts';

const FLUX_FIXTURE = [
  {
    time_tag: '2026-08-16T22:00:00',
    frequency: 2800,
    flux: 122.0,
    reporting_schedule: 'Afternoon',
    avg_begin_date: null,
    ninety_day_mean: null,
    rec_count: null,
  },
  // Not 2800 MHz — must be ignored even though it appears first-ish.
  {
    time_tag: '2026-08-16T23:00:00',
    frequency: 15400,
    flux: 999.0,
    reporting_schedule: 'Afternoon',
    avg_begin_date: null,
    ninety_day_mean: null,
    rec_count: null,
  },
  {
    time_tag: '2026-08-16T20:00:00',
    frequency: 2800,
    flux: 129.0,
    reporting_schedule: 'Noon',
    avg_begin_date: '2026-05-19T20:00:00',
    ninety_day_mean: 131.0,
    rec_count: 90,
  },
];

// Ascending time_tag order — oldest first, matching NOAA's real feed.
const KP_FIXTURE = [
  { time_tag: '2026-08-17T09:48:00', kp_index: 1, estimated_kp: 0.67, kp: '1M' },
  { time_tag: '2026-08-17T09:49:00', kp_index: 1, estimated_kp: 0.67, kp: '1M' },
  { time_tag: '2026-08-17T09:50:00', kp_index: 3, estimated_kp: 2.67, kp: '3O' },
];

function mockFetchOnce(fluxBody: unknown, kpBody: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const body = url.includes('f107_cm_flux') ? fluxBody : kpBody;
      return Promise.resolve({
        ok,
        json: () => Promise.resolve(body),
      } as Response);
    }),
  );
}

describe('fetchLatestSpaceWeather', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-08-17T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('selects the frequency === 2800 record with the latest time_tag from a multi-frequency fixture', async () => {
    mockFetchOnce(FLUX_FIXTURE, KP_FIXTURE);
    const result = await fetchLatestSpaceWeather();
    expect(result.sfi).toBe(122.0);
  });

  it('selects the last element of an ascending-order Kp fixture as the plain kp_index number', async () => {
    mockFetchOnce(FLUX_FIXTURE, KP_FIXTURE);
    const result = await fetchLatestSpaceWeather();
    expect(result.kp).toBe(3);
    expect(typeof result.kp).toBe('number');
  });

  it('stamps observedAtMs with the current time', async () => {
    mockFetchOnce(FLUX_FIXTURE, KP_FIXTURE);
    const result = await fetchLatestSpaceWeather();
    expect(result.observedAtMs).toBe(Date.parse('2026-08-17T10:00:00.000Z'));
  });

  it('throws when either response is not ok', async () => {
    mockFetchOnce(FLUX_FIXTURE, KP_FIXTURE, false);
    await expect(fetchLatestSpaceWeather()).rejects.toThrow('NOAA SWPC fetch failed');
  });

  it('throws when no frequency === 2800 record exists', async () => {
    mockFetchOnce(
      FLUX_FIXTURE.filter((row) => row.frequency !== 2800),
      KP_FIXTURE,
    );
    await expect(fetchLatestSpaceWeather()).rejects.toThrow(
      'NOAA SWPC response missing expected fields',
    );
  });

  it('throws when the Kp feed is empty', async () => {
    mockFetchOnce(FLUX_FIXTURE, []);
    await expect(fetchLatestSpaceWeather()).rejects.toThrow(
      'NOAA SWPC response missing expected fields',
    );
  });

  it('sends no query parameters (no location data) to either endpoint', async () => {
    mockFetchOnce(FLUX_FIXTURE, KP_FIXTURE);
    await fetchLatestSpaceWeather();
    const calledUrls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0] as string,
    );
    for (const url of calledUrls) {
      expect(url).not.toContain('?');
    }
  });
});
