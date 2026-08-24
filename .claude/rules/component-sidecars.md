---
paths:
  - "src/app/components/**/*"
---

# Component sidecars

**Critical rule.** When adding or materially changing a **reusable** component under `src/app/components/` without a matching sidecar update, **flag it to the user as a high concern** before or alongside your main work.

Full pattern and template: [feature-docs SKILL — Component sidecars](../../.skills/feature-docs/SKILL.md#component-sidecars-srcappcomponents) and [make-a-plan SKILL — §5](../../.skills/make-a-plan/SKILL.md).

1. Add or update **`<ComponentName>.md`** in the same directory as the component entry file (see `BuildFooter/BuildFooter.md`, `TermDefinition/TermDefinition.md` for shipped examples).
2. Cover: **Purpose**, **Props** (table), **Usage**, **Behaviour**, **Related** (feature hub link under `docs/features/`).
3. Link the sidecar from the relevant feature hub when the component is central to that surface's workflow.

One-off route glue with no reuse outside a single page does not need a sidecar — document the workflow in the feature hub instead.
