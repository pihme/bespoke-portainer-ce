import { describe, expect, it, vi } from 'vitest';

vi.mock('./queries/useGroups', () => ({
  useGroups: () => 'useGroups-mock',
}));

describe('environment-groups queries barrel', () => {
  it('re-exports useGroups', async () => {
    const mod = await import('./queries');
    expect(mod.useGroups()).toBe('useGroups-mock');
  });
});
