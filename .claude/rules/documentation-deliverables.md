---
paths:
  - "**/*.{ts,tsx,md}"
---

# Documentation deliverables

**Critical rule.** When shipping or changing **product behaviour**, documentation is part of the task — not a follow-up PR. Read [feature-docs SKILL](../../.skills/feature-docs/SKILL.md) for templates and folder layout; [component-sidecars.md](component-sidecars.md) for reusable components.

## When to document

| Change | Deliverable |
| --- | --- |
| New or changed **feature behaviour** (route, workflow, engine call, integration) | Update `docs/features/<topic>/README.md` implementation-status table and/or a deep-dive sibling |
| New **topic** under `docs/features/` | Hub README + row in [docs/features/README.md](../../docs/features/README.md) |
| New **reusable** component under `src/app/components/` | Sidecar `<ComponentName>.md` (see [component-sidecars.md](component-sidecars.md)) |
| Multi-plan / multi-agent / multi-day / multi-PR initiative | Progress + outstanding pair per [progress-tracking SKILL](../../.skills/progress-tracking/SKILL.md) |
| Engine change with a fidelity limitation | State the gap plainly in the feature doc's **Known gaps** — this is a public playground; silent gaps are worse than stated ones |

## Execution checkpoints

- **Plans:** mandatory **Documentation** section per [make-a-plan SKILL §5](../../.skills/make-a-plan/SKILL.md).
- **Before PR:** confirm deliverables are covered per [git-workflow SKILL](../../.skills/git-workflow/SKILL.md).

## Anti-patterns

- Shipping UI or engine-wired behaviour with no feature-doc update when the area already has a hub.
- Deferring docs to "a later PR" for the same slice of work.
- Describing engine fidelity as better than it is, or documenting aspirational behaviour as shipped.
