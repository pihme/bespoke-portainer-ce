import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const api = {
    name: 'portainer.app.react',
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
  componentsModule: 'portainer.app.react.components',
}));

vi.mock('./views', () => ({
  viewsModule: 'portainer.app.react.views',
}));

describe('portainer react parent module', () => {
  beforeEach(() => {
    hoisted.angularMock.module.mockClear();
    vi.resetModules();
  });

  it('aggregates views and components into portainer.app.react', async () => {
    const mod = await import('./index');
    expect(hoisted.angularMock.module).toHaveBeenCalledWith(
      'portainer.app.react',
      ['portainer.app.react.views', 'portainer.app.react.components']
    );
    expect(mod.reactModule).toBe('portainer.app.react');
  });
});
