import { describe, expect, it, vi } from 'vitest';

const { angularMock } = vi.hoisted(() => {
  const moduleApi = {
    component: vi.fn(() => moduleApi),
  };
  const angularMock = {
    module: vi.fn(() => moduleApi),
  };
  globalThis.angular = angularMock;
  return { angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./host-overview.js');

describe('hostOverview component registration', () => {
  it('registers local Docker host overview bindings', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.docker');
    const [name, config] =
      angularMock.module.mock.results[0].value.component.mock.calls[0];
    expect(name).toBe('hostOverview');
    expect(config.templateUrl).toBe('./host-overview.html');
    expect(config.transclude).toBe(true);
    expect(config.bindings).toEqual({
      hostDetails: '<',
      engineDetails: '<',
      devices: '<',
      disks: '<',
      isAgent: '<',
      agentApiVersion: '<',
      refreshUrl: '@',
      browseUrl: '@',
      hostFeaturesEnabled: '<',
      isAdmin: '<',
      endpointId: '<',
    });
  });
});
