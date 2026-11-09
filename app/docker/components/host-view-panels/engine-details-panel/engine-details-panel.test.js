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

await import('./engine-details-panel.js');

describe('engineDetailsPanel component registration', () => {
  it('registers bindings for local Docker engine details', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.docker');
    const [name, config] =
      angularMock.module.mock.results[0].value.component.mock.calls[0];
    expect(name).toBe('engineDetailsPanel');
    expect(config.templateUrl).toBe('./engine-details-panel.html');
    expect(config.bindings).toEqual({ engine: '<' });
  });
});
