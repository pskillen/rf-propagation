# SurfaceLayout

Control-panel-plus-canvas arrangement every top-level surface renders inside.

## Purpose

The one layout skeleton Reach (legend + map), Path (verdict table + path
view), and Explore (controls + globe) all build inside — a left control
panel and a canvas region, side by side on desktop, stacked on mobile.
Documented here as the pattern; later phases replace `controls`/`canvas`'
content, never the `SurfaceLayout` wrapper itself.

## Props

| Prop       | Type        | Notes                                                       |
| ---------- | ----------- | ----------------------------------------------------------- |
| `controls` | `ReactNode` | Left panel on desktop, collapses above the canvas on mobile |
| `canvas`   | `ReactNode` | Main content area — never scrolls horizontally              |

## Usage

```tsx
import SurfaceLayout from '../../components/layout/SurfaceLayout.tsx';

<SurfaceLayout controls={<Legend />} canvas={<CoverageMap />} />;
```

## Behaviour

- Desktop (>48em): two-column grid, `340px` controls column + a flexible
  canvas column.
- Mobile (≤48em, matches `MOBILE_MAX_WIDTH_MEDIA_QUERY` in
  `src/app/lib/breakpoints.ts`): single column, controls stacked above the
  canvas.
- `canvas` never scrolls horizontally at any width — verified at 360px on
  each of the four placeholder surfaces (phase 5's Slice 4 acceptance
  criterion).

## Related

- [AppChrome.tsx](../shell/AppChrome.tsx) — the persistent chrome
  `SurfaceLayout` renders inside, one level up.
