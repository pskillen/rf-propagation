# BuildFooter

Muted page footer showing build environment and version, injected at compile time.

## Purpose

Lets operators and contributors see which deployment a browser tab is running (`local`, `dev`, `main`, later `staging`/`prod`) and which version was baked in.

## Props

None.

## Usage

```tsx
import BuildFooter from './components/BuildFooter/BuildFooter.tsx';

<BuildFooter />;
```

## Behaviour

Reads `__BUILD_ENV__` and `__BUILD_VERSION__`, both injected via Vite `define` in [`vite.config.ts`](../../../../vite.config.ts) from the `BUILD_ENV` / `BUILD_VERSION` environment variables at build time, falling back to `'local'` when unset. See [`.skills/version-number/SKILL.md`](../../../../.skills/version-number/SKILL.md).

## Related

- [vite.config.ts](../../../../vite.config.ts)
- [.skills/version-number/SKILL.md](../../../../.skills/version-number/SKILL.md)
