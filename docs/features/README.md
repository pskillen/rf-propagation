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
| Reach | [reach/README.md](reach/README.md) | Shipped — 2D coverage map with a live-draggable station marker and (now) a live-draggable target marker, canvas ground-shading (hop-band hue, reliability opacity, now antenna-directional), a legend, a best-band-now summary strip, cell-selection target recording that opens the full Path view, a day/night greyline (terminator, sun marker, local toggle), and a 3D globe view (phase 9) |
| Explore | [explore/README.md](explore/README.md) | Shipped — labelled vertical cross-section, an illustration ray overlay (operator-sized controls, filter/colour-by/layer-solo, rendered on both the cross-section and the globe from one engine call), in-place term definitions, and the reusable "explain this" entry point plus a reconciling link-budget breakdown panel; rays repack rose→fan on a shared `target`, confirmed by phase 13's regression test |
| Compare | [compare/README.md](compare/README.md) | Shipped — a two-configuration side-by-side (antenna/band/time, exactly one varying), sharing the same coverage grid and link-budget calls as Reach/Explore, with a plain-km reach delta in the no-target case and an explicit per-mode dB delta table in the target-set case; shareable via the URL state codec |
| Path | [path/README.md](path/README.md) | Shipped — target picker (coordinates/locator/address/map), a band × mode verdict table ranked best-first, a geometry summary with an antenna angle-shortfall check, and `target`-driven Reach ↔ Path switching with a crossfade transition; Timeline (phase 14) not yet built |
