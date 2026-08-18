/**
 * Covers `initialViewerState`'s `display.globeToggles` defaulting (phase
 * 9, Slice 2) — specifically the "a codec-decoded field that's
 * `undefined` must NOT clobber `DEFAULT_GLOBE_TOGGLES`'s real value via a
 * blind object spread" regression flagged in this file's own comment.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_STATION } from '@core/domain/station/defaults';
import { DEFAULT_GLOBE_TOGGLES } from './globeToggles.ts';
import { ViewerStateProvider, useViewerState } from './viewerState.tsx';

function GlobeTogglesProbe() {
  const { state } = useViewerState();
  return <pre data-testid="globe-toggles">{JSON.stringify(state.display.globeToggles)}</pre>;
}

function StateProbe() {
  const { state } = useViewerState();
  return (
    <pre data-testid="viewer-state">
      {JSON.stringify({ station: state.station, playback: state.playback })}
    </pre>
  );
}

function readState(): {
  station: typeof DEFAULT_STATION;
  playback: { unrealismUnlocked: boolean };
} {
  return JSON.parse(screen.getByTestId('viewer-state').textContent ?? '{}');
}

function readGlobeToggles(): typeof DEFAULT_GLOBE_TOGGLES {
  return JSON.parse(screen.getByTestId('globe-toggles').textContent ?? '{}');
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('ViewerState.display.globeToggles', () => {
  it('defaults to DEFAULT_GLOBE_TOGGLES with no URL params', () => {
    window.history.pushState({}, '', '/');
    render(
      <ViewerStateProvider>
        <GlobeTogglesProbe />
      </ViewerStateProvider>,
    );
    expect(readGlobeToggles()).toEqual(DEFAULT_GLOBE_TOGGLES);
  });

  it('a single URL override (mapMode=globe) leaves every OTHER field at its real default -- not undefined', () => {
    window.history.pushState({}, '', '/?gm=globe');
    render(
      <ViewerStateProvider>
        <GlobeTogglesProbe />
      </ViewerStateProvider>,
    );
    const toggles = readGlobeToggles();
    expect(toggles.mapMode).toBe('globe');
    // Regression guard: these must be DEFAULT_GLOBE_TOGGLES's real values,
    // not `undefined` from a naive `{ ...DEFAULT_GLOBE_TOGGLES, ...decoded.globe }` spread.
    expect(toggles.exaggerationFactor).toBe(DEFAULT_GLOBE_TOGGLES.exaggerationFactor);
    expect(toggles.fresnelEnabled).toBe(DEFAULT_GLOBE_TOGGLES.fresnelEnabled);
    expect(toggles.explodeEnabled).toBe(DEFAULT_GLOBE_TOGGLES.explodeEnabled);
    expect(toggles.terminatorEnabled).toBe(DEFAULT_GLOBE_TOGGLES.terminatorEnabled);
    expect(toggles.cutawayEnabled).toBe(DEFAULT_GLOBE_TOGGLES.cutawayEnabled);
  });

  it('every field can be overridden from the URL at once', () => {
    window.history.pushState({}, '', '/?gx=6&ge=1&gf=0&gt=1&gc=1&gm=globe');
    render(
      <ViewerStateProvider>
        <GlobeTogglesProbe />
      </ViewerStateProvider>,
    );
    expect(readGlobeToggles()).toEqual({
      exaggerationFactor: 6,
      explodeEnabled: true,
      fresnelEnabled: false,
      terminatorEnabled: true,
      cutawayEnabled: true,
      mapMode: 'globe',
    });
  });
});

/**
 * `decoded.station`/`decoded.playback.unrealismUnlocked` (phase 10,
 * Slice 4, F7.4) — `decoded.station` was previously ignored entirely by
 * `initialViewerState` (`stationFieldCodec` could decode it, but nothing
 * applied the result), a real gap found while wiring the permalink's
 * "opening one reproduces the scenario exactly" AC, not assumed. These
 * tests cover the fix.
 */
describe('ViewerState station/playback URL overrides (F7.4)', () => {
  it('with no URL params, station is the default and unrealismUnlocked is false', () => {
    window.history.pushState({}, '', '/');
    render(
      <ViewerStateProvider>
        <StateProbe />
      </ViewerStateProvider>,
    );
    const { station, playback } = readState();
    expect(station.qth.lat).toBe(DEFAULT_STATION.qth.lat);
    expect(playback.unrealismUnlocked).toBe(false);
  });

  it('applies qlat/qlon/pwr/noise overrides on top of the default station', () => {
    window.history.pushState({}, '', '/?qlat=51.5&qlon=-0.1&pwr=400&noise=urban');
    render(
      <ViewerStateProvider>
        <StateProbe />
      </ViewerStateProvider>,
    );
    const { station } = readState();
    expect(station.qth.lat).toBe(51.5);
    expect(station.qth.lon).toBe(-0.1);
    expect(station.powerW).toBe(400);
    expect(station.noiseEnvironment).toBe('urban');
    // The locator is recomputed to stay consistent with the overridden
    // coordinates, not left stale from the default QTH.
    expect(station.qth.locator).not.toBe(DEFAULT_STATION.qth.locator);
  });

  it('applies an `ant` override by activating a matching antenna already in the array', () => {
    window.history.pushState({}, '', '/?ant=bidirectional-transverse');
    render(
      <ViewerStateProvider>
        <StateProbe />
      </ViewerStateProvider>,
    );
    const { station } = readState();
    expect(station.activeAntennaId).toBe(DEFAULT_STATION.activeAntennaId);
  });

  it('silently drops an `ant` override with no matching antenna in the (default) array', () => {
    window.history.pushState({}, '', '/?ant=multi-lobe-conical');
    render(
      <ViewerStateProvider>
        <StateProbe />
      </ViewerStateProvider>,
    );
    const { station } = readState();
    expect(station.activeAntennaId).toBe(DEFAULT_STATION.activeAntennaId);
  });

  it('applies a `ru=1` override to unrealismUnlocked', () => {
    window.history.pushState({}, '', '/?ru=1');
    render(
      <ViewerStateProvider>
        <StateProbe />
      </ViewerStateProvider>,
    );
    expect(readState().playback.unrealismUnlocked).toBe(true);
  });
});
