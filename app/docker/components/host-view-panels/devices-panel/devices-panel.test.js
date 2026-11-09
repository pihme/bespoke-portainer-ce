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

await import('./devices-panel.js');

describe('devicesPanel component registration', () => {
  it('registers bindings for local Docker host devices', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.docker');
    const [name, config] =
      angularMock.module.mock.results[0].value.component.mock.calls[0];
    expect(name).toBe('devicesPanel');
    expect(config.templateUrl).toBe('./devices-panel.html');
    expect(config.bindings).toEqual({ devices: '<' });
  });
});
