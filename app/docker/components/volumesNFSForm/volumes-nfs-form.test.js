import { describe, expect, it, vi, beforeEach } from 'vitest';

const { angularMock, moduleApi, components } = vi.hoisted(() => {
  const components = [];
  const moduleApi = {
    component: vi.fn((name, def) => {
      components.push({ name, def });
      return moduleApi;
    }),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  globalThis.angular = angularMock;
  return { angularMock, moduleApi, components };
});

describe('volumesNfsForm component', () => {
  beforeEach(() => {
    components.length = 0;
    angularMock.module.mockClear();
    moduleApi.component.mockClear();
  });

  it('registers the volumesNfsForm component with template and two-way data binding', async () => {
    await import('./volumes-nfs-form.js');
    expect(angularMock.module).toHaveBeenCalledWith('portainer.docker');
    expect(components[0]?.name).toBe('volumesNfsForm');
    expect(components[0]?.def).toMatchObject({
      templateUrl: './volumesnfsForm.html',
      bindings: { data: '=' },
    });
  });
});
