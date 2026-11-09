import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const api = {
    name: 'portainer.docker.react',
  };
  const angularMock = {
    module: vi.fn(() => api),
  };
  return { api, angularMock };
});

vi.mock('angular', () => ({
  default: hoisted.angularMock,
  module: hoisted.angularMock.module,
}));

vi.mock('./components', () => ({
  componentsModule: 'portainer.docker.react.components',
}));

vi.mock('./views', () => ({
  viewsModule: 'portainer.docker.react.views',
}));

describe('docker react parent module', () => {
  beforeEach(() => {
    hoisted.angularMock.module.mockClear();
    vi.resetModules();
  });

  it('aggregates views and components into portainer.docker.react', async () => {
    const mod = await import('./index');
    expect(hoisted.angularMock.module).toHaveBeenCalledWith(
      'portainer.docker.react',
      ['portainer.docker.react.views', 'portainer.docker.react.components']
    );
    expect(mod.reactModule).toBe('portainer.docker.react');
  });
});
