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

await import('./por-endpoint-security.js');

describe('porEndpointSecurity component registration', () => {
  it('registers TLS form bindings for a local Docker environment', () => {
    expect(angularMock.module).toHaveBeenCalledWith('portainer.app');
    const config = angularMock.module.mock.results[0].value.component.mock.calls[0][1];
    expect(config.controller).toBe('porEndpointSecurityController');
    expect(config.bindings).toEqual({
      formData: '=',
      endpoint: '<',
    });
  });
});
