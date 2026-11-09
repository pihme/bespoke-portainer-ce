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

await import('./product-item.js');

describe('productItem component registration', () => {
  it('registers CE-facing item bindings (BE upsell content deferred)', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.app');
    const [name, config] =
      angularMock.module.mock.results[0].value.component.mock.calls[0];
    expect(name).toBe('productItem');
    expect(config.templateUrl).toBe('./productItem.html');
    expect(config.bindings).toEqual({
      model: '<',
      goTo: '<',
    });
  });
});
