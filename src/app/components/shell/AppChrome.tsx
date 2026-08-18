import type { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { IconClock, IconRoute, IconTelescope, IconWorld } from '@tabler/icons-react';
import BuildFooter from '../BuildFooter/BuildFooter.tsx';
import { BottomTabBar } from '../v2/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './AppChrome.module.css';

export interface AppChromeProps {
  /** Filled by phase 6 (Station, F4.1) — rendered empty until then. */
  stationBar?: ReactNode;
  /** Filled by phase 7 (Conditions, F4.6) — rendered empty until then. */
  conditionsBar?: ReactNode;
  /**
   * Filled by phase 10's `TransportControl` (F7.1) — a third persistent
   * chrome slot, mounted once here (not inside any one surface), which is
   * what makes "works on every surface" true by construction rather than
   * by separate per-surface wiring.
   */
  transportControl?: ReactNode;
  /** Filled by phase 10's `ResetButton` (F7.2) — "always available," so it lives in the header next to primary nav, not behind any surface panel. */
  resetButton?: ReactNode;
  /** Filled by phase 10's `ShareButton` (F7.4) — same "always available" header placement as `resetButton`. */
  shareButton?: ReactNode;
  children: ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'reach', label: 'Reach', path: '/' },
  { id: 'path', label: 'Path', path: '/path' },
  { id: 'timeline', label: 'Timeline', path: '/timeline' },
  { id: 'explore', label: 'Explore', path: '/explore' },
];

const NAV_ICONS: Record<string, ReactNode> = {
  reach: <IconWorld size={ICON_SIZE_NAV} stroke={ICON_STROKE} aria-hidden />,
  path: <IconRoute size={ICON_SIZE_NAV} stroke={ICON_STROKE} aria-hidden />,
  timeline: <IconClock size={ICON_SIZE_NAV} stroke={ICON_STROKE} aria-hidden />,
  explore: <IconTelescope size={ICON_SIZE_NAV} stroke={ICON_STROKE} aria-hidden />,
};

/**
 * Top-level chrome: brand + primary nav (desktop top nav / mobile bottom tab
 * bar, both present in the DOM, visibility breakpoint-driven), the two
 * reserved persistent-chrome slots (`stationBar` filled by phase 6,
 * `conditionsBar` filled by phase 7), the routed surface, and the build
 * footer.
 *
 * Not a port of Studio's `AppShell.tsx` (project chip / avatar / build
 * chrome) — this app has no projects, builds, or accounts.
 */
export default function AppChrome({
  stationBar,
  conditionsBar,
  transportControl,
  resetButton,
  shareButton,
  children,
}: AppChromeProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = NAV_ITEMS.find((item) => item.path === location.pathname)?.id ?? 'reach';

  return (
    <div className={classes.root}>
      <header className={classes.header}>
        <span className={classes.brand}>Propagation Viewer</span>
        <nav className={classes.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                [classes.navLink, isActive ? classes.navLinkActive : ''].filter(Boolean).join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {shareButton}
        {resetButton}
      </header>
      <div className={classes.stationBar} data-slot="station-bar">
        {stationBar}
      </div>
      <div className={classes.conditionsBar} data-slot="conditions-bar">
        {conditionsBar}
      </div>
      <div className={classes.transportControl} data-slot="transport-control">
        {transportControl}
      </div>
      <main className={classes.main}>{children}</main>
      <BuildFooter />
      <BottomTabBar
        className={classes.mobileNav}
        items={NAV_ITEMS.map((item) => ({
          id: item.id,
          label: item.label,
          icon: NAV_ICONS[item.id],
        }))}
        activeId={activeId}
        onChange={(id) => {
          const item = NAV_ITEMS.find((candidate) => candidate.id === id);
          if (item) navigate(item.path);
        }}
      />
    </div>
  );
}
