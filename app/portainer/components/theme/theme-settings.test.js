import { describe, expect, it, vi } from 'vitest';

const { componentState, angularMock } = vi.hoisted(() => {
  const componentState = { def: null };
  const moduleApi = {
    component: vi.fn((_name, def) => {
      componentState.def = def;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { componentState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('./theme-settings.controller', () => ({
  default: function ThemeSettingsController() {},
}));

await import('./theme-settings.js');

describe('REQ-SET-01 themeSettings component', () => {
  it('registers the themeSettings component on portainer.app', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.app');
    expect(componentState.def).toMatchObject({
      templateUrl: './theme-settings.html',
      controller: expect.any(Function),
    });
  });
});
