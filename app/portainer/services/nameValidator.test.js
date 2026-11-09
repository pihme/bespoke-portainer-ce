import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/react/portainer/environments/environment.service', () => ({
  getEnvironments: vi.fn(),
}));

await import('./nameValidator.js');
const { getEnvironments } = await import('@/react/portainer/environments/environment.service');

describe('REQ-ENV-01 NameValidator environment name', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validateEnvironmentName returns true when a matching environment exists', async () => {
    getEnvironments.mockResolvedValue({ value: [{ Id: 1, Name: 'local' }] });
    const Notifications = { error: vi.fn() };
    const service = factoryState.factory(Notifications);
    await expect(service.validateEnvironmentName('local')).resolves.toBe(true);
  });

  it('validateEnvironmentName returns false when no environment matches', async () => {
    getEnvironments.mockResolvedValue({ value: [] });
    const Notifications = { error: vi.fn() };
    const service = factoryState.factory(Notifications);
    await expect(service.validateEnvironmentName('missing')).resolves.toBe(false);
  });

  it('validateEnvironmentName notifies on failure', async () => {
    getEnvironments.mockRejectedValue(new Error('down'));
    const Notifications = { error: vi.fn() };
    const service = factoryState.factory(Notifications);
    await service.validateEnvironmentName('local');
    expect(Notifications.error).toHaveBeenCalledWith(
      'Failure',
      expect.any(Error),
      'Unable to retrieve environment details'
    );
  });
});
