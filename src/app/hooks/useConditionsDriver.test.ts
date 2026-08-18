import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONDITIONS } from '@core/domain/conditions/defaults';
import type { ConditionsDriver } from '@core/domain/conditions/types';
import { describeDriverProvenance, useConditionsDriver } from './useConditionsDriver.ts';

const mockFetchLatestSpaceWeather = vi.fn();
const mockLoadLastKnownDriver = vi.fn();
const mockSaveLastKnownDriver = vi.fn();

vi.mock('@integrations/spaceWeather/noaaClient', () => ({
  fetchLatestSpaceWeather: (...args: unknown[]) => mockFetchLatestSpaceWeather(...args),
}));

vi.mock('@integrations/conditions/persistence', () => ({
  loadLastKnownDriver: (...args: unknown[]) => mockLoadLastKnownDriver(...args),
  saveLastKnownDriver: (...args: unknown[]) => mockSaveLastKnownDriver(...args),
}));

describe('useConditionsDriver', () => {
  beforeEach(() => {
    mockFetchLatestSpaceWeather.mockReset();
    mockLoadLastKnownDriver.mockReset().mockReturnValue(null);
    mockSaveLastKnownDriver.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses a fresh live reading on a successful fetch', async () => {
    mockFetchLatestSpaceWeather.mockResolvedValue({ sfi: 145, kp: 3, observedAtMs: 1000 });
    const { result } = renderHook(() => useConditionsDriver());

    await waitFor(() => {
      expect(result.current.driver).toEqual({
        kind: 'live',
        sfi: 145,
        kp: 3,
        fetchedAtMs: 1000,
      });
    });
    expect(mockSaveLastKnownDriver).toHaveBeenCalledWith({
      kind: 'live',
      sfi: 145,
      kp: 3,
      fetchedAtMs: 1000,
    });
  });

  it('falls back to last-known when the fetch fails and a last-known value exists', async () => {
    const lastKnown: ConditionsDriver = { kind: 'live', sfi: 130, kp: 1, fetchedAtMs: 500 };
    mockLoadLastKnownDriver.mockReturnValue(lastKnown);
    mockFetchLatestSpaceWeather.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useConditionsDriver());

    await waitFor(() => {
      expect(mockFetchLatestSpaceWeather).toHaveBeenCalled();
    });
    // Give the rejected promise's .catch a microtask turn.
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.driver).toEqual(lastKnown);
  });

  it('falls back to the canned preset when the fetch fails and there is no last-known value', async () => {
    mockLoadLastKnownDriver.mockReturnValue(null);
    mockFetchLatestSpaceWeather.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useConditionsDriver());

    await waitFor(() => {
      expect(mockFetchLatestSpaceWeather).toHaveBeenCalled();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.driver).toEqual(DEFAULT_CONDITIONS.driver);
  });

  it('never throws past the hook on fetch failure', async () => {
    mockFetchLatestSpaceWeather.mockRejectedValue(new Error('network down'));
    expect(() => renderHook(() => useConditionsDriver())).not.toThrow();
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('a manual override takes precedence over a live reading until cleared', async () => {
    mockFetchLatestSpaceWeather.mockResolvedValue({ sfi: 145, kp: 3, observedAtMs: 1000 });
    const { result } = renderHook(() => useConditionsDriver());

    await waitFor(() => {
      expect(result.current.driver.kind).toBe('live');
    });

    act(() => {
      result.current.setManualDriver(200, 7);
    });
    expect(result.current.driver).toEqual({ kind: 'manual', sfi: 200, kp: 7 });
    expect(result.current.isManual).toBe(true);

    act(() => {
      result.current.clearManualDriver();
    });
    expect(result.current.driver.kind).toBe('live');
    expect(result.current.isManual).toBe(false);
  });
});

describe('describeDriverProvenance', () => {
  it('labels a fresh live driver with its age', () => {
    const nowMs = 1000 + 5 * 60_000;
    const driver: ConditionsDriver = { kind: 'live', sfi: 120, kp: 2, fetchedAtMs: 1000 };
    expect(describeDriverProvenance(driver, nowMs)).toBe('Live (5 min ago)');
  });

  it('labels a stale last-known driver (kind is still live) with its larger age', () => {
    const nowMs = 43 * 60_000;
    const driver: ConditionsDriver = { kind: 'live', sfi: 120, kp: 2, fetchedAtMs: 0 };
    expect(describeDriverProvenance(driver, nowMs)).toBe('Live (43 min ago)');
  });

  it('labels a manual driver', () => {
    expect(describeDriverProvenance({ kind: 'manual', sfi: 200, kp: 7 })).toBe('Manual');
  });

  it('labels a preset driver', () => {
    expect(describeDriverProvenance({ kind: 'preset', sfi: 120, kp: 2 })).toBe('Preset');
  });
});
