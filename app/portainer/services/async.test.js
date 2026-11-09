import { describe, expect, it, vi } from 'vitest';

import { mockQ } from './angularFactoryHelpers.test.js';

const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
  const moduleApi = {
    factory: vi.fn((_name, depsOrFn) => {
      factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./async.js');

describe('$async helper (backwards compatibility)', () => {
  it('resolves with the async function result', async () => {
    const $async = factoryState.factory(mockQ());
    await expect($async(async (a, b) => a + b, 2, 3)).resolves.toBe(5);
  });

  it('rejects when the async function throws', async () => {
    const $async = factoryState.factory(mockQ());
    await expect($async(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  });
});
