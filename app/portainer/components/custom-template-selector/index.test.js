import { describe, expect, it, vi } from 'vitest';

const { angularMock, components } = vi.hoisted(() => {
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
  return { angularMock, components, moduleApi };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('./custom-template-selector.controller.js', () => ({
  default: class Controller {},
}));

describe('customTemplateSelector component registration', () => {
  it('registers bindings and template on portainer.app', async () => {
    const mod = await import('./index.js');
    expect(angularMock.module).toHaveBeenCalledWith('portainer.app');
    expect(components[0].name).toBe('customTemplateSelector');
    expect(components[0].def.bindings).toMatchObject({
      value: '<',
      onChange: '<',
      stackType: '<',
    });
    expect(components[0].def.templateUrl).toContain('custom-template-selector.html');
    expect(mod.customTemplateSelector).toBeTruthy();
  });
});
