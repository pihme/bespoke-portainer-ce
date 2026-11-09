import { describe, expect, it, vi } from 'vitest';

const { componentConfig, angularMock } = vi.hoisted(() => {
  let componentConfig;
  const moduleApi = {
    component: vi.fn((_name, config) => {
      componentConfig = config;
      return moduleApi;
    }),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  globalThis.angular = angularMock;
  return {
    get componentConfig() {
      return componentConfig;
    },
    set componentConfig(v) {
      componentConfig = v;
    },
    angularMock,
  };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('./code-editor.controller', () => ({
  default: function MockController() {},
}));

await import('./code-editor.js');

describe('codeEditor angular component registration', () => {
  it('registers bindings for local compose editor usage', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.app');
    // componentConfig captured via moduleApi - re-read from mock calls
    const config = angularMock.module.mock.results[0].value.component.mock.calls[0][1];
    expect(config.bindings).toMatchObject({
      identifier: '@',
      yml: '<',
      onChange: '<',
      value: '<',
    });
  });
});
