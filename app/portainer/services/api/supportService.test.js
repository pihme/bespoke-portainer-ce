import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mockQ, promiseResource, rejectResource } from './angularFactoryHelpers.test.js';

const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
  const moduleApi = {
    factory: vi.fn((_name, depsOrFn) => {
      factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
    service: vi.fn((_name, fn) => {
      factoryState.factory = fn;
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

await import('./supportService.js');

describe('SupportService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('supportProducts returns the Support resource payload', async () => {
    const Support = {
      get: vi.fn(() => promiseResource([{ Id: 1, Name: 'priority' }])),
    };
    const service = factoryState.factory(mockQ(), Support);
    await expect(service.supportProducts()).resolves.toEqual([{ Id: 1, Name: 'priority' }]);
    expect(Support.get).toHaveBeenCalled();
  });

  it('supportProducts rejects with a clear message on failure', async () => {
    const Support = { get: vi.fn(() => rejectResource(new Error('down'))) };
    const service = factoryState.factory(mockQ(), Support);
    await expect(service.supportProducts()).rejects.toMatchObject({
      msg: 'Unable to retrieve support options',
    });
  });
});
