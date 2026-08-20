/**
 * The Conditions clock's own writer (`scrubTo`, phase 10's `useConditions`)
 * lives in `App.tsx`'s `Shell`, above the router — nothing outside
 * `ConditionsBar`/`TransportControl` could previously WRITE `atMs` (only
 * read a one-way-published copy via `ViewerState.conditions`, per that
 * file's own doc comment). Timeline (phase 14, F11.2, [#74]) is the first
 * routed page that needs to write it directly (cell-click -> scrub), so
 * `Shell` passes `scrubTo`/`atMs`/`liveNow` down through React Router's
 * own `<Outlet context={...}>` mechanism — reusing the EXISTING clock
 * writer, not inventing a second one (per this phase's own plan file:
 * "prefer existing scrub/playback APIs over inventing a parallel clock
 * writer").
 *
 * [#74]: https://github.com/pskillen/rf-propagation/issues/74
 */
export interface ShellOutletContext {
  atMs: number;
  liveNow: boolean;
  scrubTo: (atMs: number) => void;
}
