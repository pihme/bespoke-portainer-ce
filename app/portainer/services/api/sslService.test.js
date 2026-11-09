import { describe, it, expect, vi, beforeEach } from 'vitest';

import { promiseResource } from './angularFactoryTestUtils';


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
  // Production factories use bare global `angular` (no import).
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./sslService.js');

describe('SSLService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('get and upload forward to the SSL resource', async () => {
    const SSL = {
      get: vi.fn(() => promiseResource({ cert: 'x' })),
      upload: vi.fn(() => promiseResource({ ok: true })),
    };
    const service = factoryState.factory(SSL);
    await expect(service.get()).resolves.toEqual({ cert: 'x' });
    await expect(service.upload({ cert: 'a', key: 'b' })).resolves.toEqual({ ok: true });
    expect(SSL.upload).toHaveBeenCalledWith({ cert: 'a', key: 'b' });
  });
});
