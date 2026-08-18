# Gaps — index

Discussion documents surfaced mid-series, outside the normal phase-review
flow: things noticed by inspection or by asking questions of the plan that
don't fit neatly into "revise the current phase file" because they span
multiple phases, or concern phases not yet built. Most of these are plans in
name only — no code or plan-file changes were made as a result of them. One
exception: [wire-antenna-configurations.md](wire-antenna-configurations.md)
accompanies a small, explicitly-scoped code change (a heading field + label
rename) alongside the gap write-up; that file says so up front and the
modelling gap itself is unchanged by it. They otherwise exist to carry a
fully-traced argument into a future planning-agent conversation, if/when the
gap gets picked up.

See [tmp/mvp-plan/plans/00-README.md](../plans/00-README.md) for the actual
phase index and series status; each gap file below links to that context
rather than duplicating it, but repeats a snapshot of the phase/PR table as
of when it was written since these files aren't kept in sync with the
series as it advances.

## Open gaps

| File | What it's about | Status as of writing |
| --- | --- | --- |
| [directionality.md](directionality.md) | Reach's coverage grid (phase 8, shipped) feeds a flat, non-azimuth-dependent antenna gain into every grid cell — rotating a directional antenna's heading has no visible effect on the coverage map, contradicting an explicit requirement in `feature-description.md`. Sharpest downstream case: Compare (phase 12) comparing a dipole against a beam would show the wrong answer. | Already-shipped gap in merged/open-PR code (phases 2–8) |
| [grayline.md](grayline.md) | The greyline/terminator (day-night shading, sun marker) is planned for the 3D globe (phase 9, not yet built) but nowhere for Reach's 2D map (phase 8, shipped) — including the mobile default surface. Reads as an unstated scoping decision rather than a dropped requirement. | Forward-looking; phase 9 not yet built |
| [antenna-editing.md](antenna-editing.md) | My Station > Antennas (phase 6, shipped): no way to view/edit an antenna after creation, the pattern preview shows the previously-active antenna while adding a new one, a proposal to swap the elevation line-chart for three polar plots (two orthogonal 180° vertical cuts — parallel and perpendicular to boresight — plus a 360° horizontal cut; full 3D deferred), and a real modelling gap — dipoles have azimuth-dependent gain math but no UI field to set heading; multi-lobe/wire antennas have neither. | New scope surfaced by hands-on use, not a dropped requirement |
| [wire-antenna-configurations.md](wire-antenna-configurations.md) | `multi-lobe-conical` (now labelled "Long wire (straight, level)") only ever modelled one of the many real-world wire-antenna configurations (dipole, inverted-V, sloper, inverted-L, long wire, doublet/OCF) — the others have no `AntennaPatternFamily` at all. Accompanies a small code change: heading field added for this family (with an inline caveat that the pattern doesn't yet rotate with it), display label tightened; internal identifier and formula both left untouched to avoid a persistence migration. | New scope surfaced by hands-on use; small code change included, modelling gap itself still open |
| [antenna-height-effects.md](antenna-height-effects.md) | `antennaGain()`'s gain-shape math only reads `AntennaConfig.heightM` for one of its four pattern families (`bidirectional-transverse`/dipole, via `groundReflectionFactor`) — for `omnidirectional-vertical`, `directional-lobe` (beam), and `multi-lobe-conical` (long wire), the height field the UI always shows is collected and silently discarded. Also traces a separately-investigated live-tested anomaly (editing a dipole's height 1 m → 100 m didn't visibly change Reach's coverage map) to the coverage grid's best-of-all-elevations cell selection and saturating reliability model, not to a code bug. | New scope surfaced by hands-on use; no code change, modelling gap open; dipole anomaly investigated and explained (not a bug) |

## Conventions for adding a gap file

- One file per gap, named for the subject (`kebab-case.md`), added to this
  table.
- Open with a **Series status** section — a one- or two-line pointer to
  [gaps/directionality.md § Series status](directionality.md#series-status)
  plus a note on what's changed, rather than re-deriving the phase/PR table
  from scratch each time.
- Trace **what's covered today**, **what's not**, and — where it applies —
  **where the requirement got dropped**, citing real file paths and line
  numbers rather than paraphrasing from memory.
- Include a **downstream implications** section for phases not yet built,
  and an **options, not a recommendation** section that stops short of
  picking a fix — that's for the follow-up conversation, not this file.
- State plainly, near the top, that no code or plan changes have been made
  as a result of the file.
