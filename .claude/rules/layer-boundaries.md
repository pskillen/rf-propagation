---
paths:
  - "src/**"
---

# Layer boundaries

**Critical rule.** When editing related files, if you notice existing code that violates this rule — even outside your current task — **flag it to the user as a high concern** before or alongside your main work. Do not silently ignore, copy the pattern, or defer without mention.

Read [AGENTS.md — Planned architecture](../../AGENTS.md#planned-architecture).

## Layers

| Layer | Path | Contains | Must not contain |
| --- | --- | --- | --- |
| **core** | `src/core/` | Domain models, the propagation engine, pure functions (geometry, layer model, reflection/MUF selection, link budget, multi-hop solving, coverage grid, illustration rays) | React, Mantine, DOM APIs, `localStorage`, Worker `postMessage` plumbing |
| **integrations** | `src/integrations/` | Browser I/O — the coverage-grid Worker (protocol, entry point, typed client), conditions/space-weather fetches, geocoding, station persistence | React components; propagation physics that belongs in core |
| **app** | `src/app/` | Routes, features, components, thin React state adapters | Physics math reimplemented inline instead of calling core; the coverage-grid Worker's raw message protocol (use its typed client) |

## Dependency direction

```text
app → core
integrations → core
```

**Never** `core` → `app`. **Never** `core` → `integrations`.

Components call the engine's exported functions (`src/core/domain/propagation/`) or an integrations-layer typed client (e.g. `coverageGridClient`) — not ad hoc physics or a worker's raw protocol messages in `src/app/`.

## Anti-patterns

- Importing React or Mantine in `src/core/`
- Duplicating a geometry/MUF/link-budget calculation inline in a component instead of calling the engine
- Persistence or `postMessage` protocol code inside `src/core/`
- `src/app/` reaching past `coverageGridClient` into `coverageWorkerHandler`/`protocol.ts` directly
