import type { ReactNode } from 'react';
import classes from './SurfaceLayout.module.css';

export interface SurfaceLayoutProps {
  /** Left panel on desktop, collapses above the canvas on mobile. */
  controls: ReactNode;
  /** Never scrolls horizontally — see SurfaceLayout.md. */
  canvas: ReactNode;
}

/**
 * Control-panel-plus-canvas arrangement every surface (Reach's legend+map,
 * Path's verdict table+path view, Explore's controls+globe) renders inside.
 * Later phases replace `controls`/`canvas`' content, never this wrapper.
 */
export default function SurfaceLayout({ controls, canvas }: SurfaceLayoutProps) {
  return (
    <div className={classes.root}>
      <div className={classes.controls}>{controls}</div>
      <div className={classes.canvas}>{canvas}</div>
    </div>
  );
}
