# Feature documentation index

Canonical feature docs for the Propagation Viewer, one folder per topic.
See [feature-docs](../../.skills/feature-docs/SKILL.md) for the conventions
these follow.

| Topic | Hub | Status |
| --- | --- | --- |
| Propagation engine | [engine/README.md](engine/README.md) | In progress — geometry, layer model, MUF selection, link budget, the V1–V23 validation harness, multi-hop path solving, the coverage grid, illustration rays, and the coverage-grid Worker are shipped; no UI surfaces exist yet |
| App shell and design system | [app-shell/README.md](app-shell/README.md) | In progress — component kit + theme copy, four-surface routing, URL state codec, responsive layout skeleton, and the playground controls (transport control/time-lapse, global reset, realism unlock, permalink sharing, preset scenarios) are shipped |
| Station | [station/README.md](station/README.md) | In progress — Station model, fail-soft persistence, URL codec registration, QTH picker, antenna model with absolute dBi, TX power/noise environment inputs, and the always-populated Station bar are shipped; wired to the propagation engine by phase 8 (Reach) |
| Conditions | [conditions/README.md](conditions/README.md) | In progress — Conditions model (SFI/Kp unit contract), now-toggle + time scrubber, URL codec registration, NOAA SWPC live fetch with a full live/last-known/manual/preset fallback chain and always-visible provenance, and the trimmed amateur-HF band catalogue + chips are shipped; wired to the propagation engine by phase 8 (Reach) |
| Reach | [reach/README.md](reach/README.md) | Shipped — 2D coverage map with a live-draggable station marker, canvas ground-shading (hop-band hue, reliability opacity, now antenna-directional), a legend, a best-band-now summary strip, cell-selection target recording, a day/night greyline (terminator, sun marker, local toggle), and a 3D globe view (phase 9); the full Path view (phase 13) is not yet built |
