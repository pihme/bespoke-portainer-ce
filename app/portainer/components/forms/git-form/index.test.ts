import { describe, expect, it, vi } from 'vitest';

const { angularMock, moduleApi, components } = vi.hoisted(() => {
  const components: Array<{ name: string; def: unknown }> = [];
  const moduleApi = {
    name: '',
    component: vi.fn((name: string, def: unknown) => {
      components.push({ name, def });
      return moduleApi;
    }),
  };
  const angularMock = {
    module: vi.fn((name: string) => {
      moduleApi.name = name;
      return moduleApi;
    }),
  };
  globalThis.angular = angularMock as never;
  return { angularMock, moduleApi, components };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('./git-form', () => ({
  gitForm: { template: '<div></div>', bindings: {}, controller: class {} },
}));

describe('gitFormModule', () => {
  it('registers the gitForm component', async () => {
    const { gitFormModule } = await import('./index');
    expect(gitFormModule).toBe('portainer.app.components.git-form');
    expect(angularMock.module).toHaveBeenCalledWith(
      'portainer.app.components.git-form',
      []
    );
    expect(components[0]?.name).toBe('gitForm');
  });
});
