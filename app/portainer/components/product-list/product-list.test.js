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

await import('./product-list.js');

describe('productList component registration', () => {
  it('registers CE-facing list bindings (BE product catalog deferred)', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.app');
    const [name, config] =
      angularMock.module.mock.results[0].value.component.mock.calls[0];
    expect(name).toBe('productList');
    expect(config.templateUrl).toBe('./productList.html');
    expect(config.bindings).toEqual({
      titleText: '@',
      products: '<',
      goTo: '<',
    });
  });
});
