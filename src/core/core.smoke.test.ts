import { describe, expect, it } from 'vitest';

// Trivial smoke test proving the Vitest runner is wired up end to end
// (config, aliases, jsdom environment). Real engine tests arrive in phase 2.
describe('toolchain smoke test', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
