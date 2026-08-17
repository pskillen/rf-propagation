// Vitest global setup — jest-dom matchers (toBeInTheDocument, etc.) for
// component tests, added alongside this phase's first component tests
// (QthPicker's four-conveniences sync / geolocation-denial coverage).
// matchMedia/ResizeObserver polyfills ported from Codeplug Studio's own
// src/test/setup.ts — jsdom doesn't implement either, and Mantine
// (MantineProvider, used by DesignSystemV2Provider) needs matchMedia.
import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class ResizeObserverMock {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
});
