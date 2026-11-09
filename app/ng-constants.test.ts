import { describe, expect, it, vi } from 'vitest';

const constant = vi.fn(function constant(this: { name: string }) {
  return this;
});

vi.mock('angular', () => ({
  default: {
    module: vi.fn(() => {
      const mod = { constant, name: 'portainer.app.constants' };
      return mod;
    }),
  },
}));

vi.mock('./react/constants', () => ({
  BROWSER_OS_PLATFORM: 'linux',
}));

describe('ng-constants', () => {
  it('registers Portainer constants on an angular module', async () => {
    const { constantsModule } = await import('./ng-constants');
    expect(constantsModule).toBe('portainer.app.constants');
    expect(constant).toHaveBeenCalledWith('API_ENDPOINT_AUTH', 'api/auth');
    expect(constant).toHaveBeenCalledWith('PREDEFINED_NETWORKS', [
      'host',
      'bridge',
      'ingress',
      'nat',
      'none',
    ]);
    expect(constant).toHaveBeenCalledWith('BROWSER_OS_PLATFORM', 'linux');
  });
});
