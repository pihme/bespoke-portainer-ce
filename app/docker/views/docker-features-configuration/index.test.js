import { describe, expect, it, vi } from 'vitest';

const { angularMock, moduleApi, componentMock } = vi.hoisted(() => {
  const componentMock = vi.fn();
  const moduleApi = { component: componentMock };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { angularMock, moduleApi, componentMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('./docker-features-configuration.controller', () => ({
  default: class MockController {},
}));

await import('./index.js');

describe('REQ-HOST-04 dockerFeaturesConfigurationView registration', () => {
  it('registers the component on portainer.docker with endpoint binding', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.docker');
    expect(componentMock).toHaveBeenCalledWith(
      'dockerFeaturesConfigurationView',
      expect.objectContaining({
        templateUrl: './docker-features-configuration.html',
        bindings: { endpoint: '<' },
      })
    );
  });
});
