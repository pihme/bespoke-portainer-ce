import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mockQ } from './angularFactoryTestUtils';


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

vi.mock('@/react/portainer/system/useSystemStatus', () => ({
  getSystemStatus: vi.fn(),
}));

const { getSystemStatus } = await import('@/react/portainer/system/useSystemStatus');
await import('./statusService.js');

describe('REQ-ENV-02 StatusService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('status maps system status into StatusViewModel', async () => {
    getSystemStatus.mockResolvedValue({ Version: '2.45.3', InstanceID: 'abc' });
    const service = factoryState.factory(mockQ());
    const status = await service.status();
    expect(status.Version).toBe('2.45.3');
  });

  it('status rejects with a clear message on failure', async () => {
    getSystemStatus.mockRejectedValue(new Error('down'));
    const service = factoryState.factory(mockQ());
    await expect(service.status()).rejects.toMatchObject({
      msg: 'Unable to retrieve application status',
    });
  });
});
