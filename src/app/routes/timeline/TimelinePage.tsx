/**
 * Timeline — "when should I try?" (F11, phase 14): a 24-hour x band
 * reliability grid for the operator's current Path target, or for a
 * nominated reference distance/bearing when no target is set (Reach
 * mode). Timeline is an explicitly-navigated surface, unaffected by
 * `activeAnswerSurface`'s Reach<->Path discriminator (phase 13's own
 * deviation note) — it reads `ViewerState.target` directly, same as every
 * other surface, but never switches itself in/out based on it.
 *
 * Slice 1 (`@core/domain/propagation/timelineGrid`) computes the grid;
 * `useTimelineGrid.ts` assembles its input from Station/Conditions/
 * Target/Timeline state; `TimelineGrid.tsx` renders it. Slice 3 wires
 * cell-click to the Conditions clock via `useOutletContext`'s
 * `scrubTo` (see `shellOutletContext.ts`'s own doc comment for why that
 * indirection exists) — a plain click handler, not a drag: FR-27's
 * "world updates during the drag" standing constraint doesn't apply to a
 * discrete click.
 */
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import SurfaceLayout from '../../components/layout/SurfaceLayout.tsx';
import { Panel } from '../../components/v2/index.ts';
import { useViewerState } from '../../state/viewerState.tsx';
import type { ShellOutletContext } from '../shellOutletContext.ts';
import { useTimelineGrid } from './useTimelineGrid.ts';
import TimelineGrid from './TimelineGrid.tsx';
import ReferenceDistanceControl from './ReferenceDistanceControl.tsx';
import classes from './TimelinePage.module.css';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export default function TimelinePage() {
  const { state, setState } = useViewerState();
  const { atMs, scrubTo } = useOutletContext<ShellOutletContext>();
  const [selectedHourUtc, setSelectedHourUtc] = useState<number | undefined>(undefined);

  const cells = useTimelineGrid(state.station, state.conditions, state.target, state.timeline);

  const currentHourUtc = new Date(atMs).getUTCHours();

  function handleSelectHour(hourUtc: number) {
    setSelectedHourUtc(hourUtc);
    // Only the hour-of-day changes -- the swept day (Slice 1's own "which
    // day" note) stays exactly what it was, so selecting a cell can never
    // move the sweep to a different day out from under the operator
    // (F11.2's own acceptance criterion).
    const startOfDayUtcMs = Math.floor(atMs / MS_PER_DAY) * MS_PER_DAY;
    scrubTo(startOfDayUtcMs + hourUtc * MS_PER_HOUR);
  }

  return (
    <SurfaceLayout
      controls={
        state.target === null ? (
          <Panel title="Reference path" sub="Used when no Path target is set.">
            <ReferenceDistanceControl
              value={state.timeline}
              onChange={(next) => setState((prev) => ({ ...prev, timeline: next }))}
            />
          </Panel>
        ) : null
      }
      canvas={
        <div className={classes.root}>
          <TimelineGrid
            cells={cells}
            currentHourUtc={currentHourUtc}
            selectedHourUtc={selectedHourUtc}
            onSelectHour={handleSelectHour}
          />
        </div>
      }
    />
  );
}
