/**
 * Covers `initialViewerState`'s `display.globeToggles` defaulting (phase
 * 9, Slice 2) — specifically the "a codec-decoded field that's
 * `undefined` must NOT clobber `DEFAULT_GLOBE_TOGGLES`'s real value via a
 * blind object spread" regression flagged in this file's own comment.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_GLOBE_TOGGLES } from './globeToggles.ts';
import { ViewerStateProvider, useViewerState } from './viewerState.tsx';

function GlobeTogglesProbe() {
  const { state } = useViewerState();
  return <pre data-testid="globe-toggles">{JSON.stringify(state.display.globeToggles)}</pre>;
}

function readGlobeToggles(): typeof DEFAULT_GLOBE_TOGGLES {
  return JSON.parse(screen.getByTestId('globe-toggles').textContent ?? '{}');
}

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
