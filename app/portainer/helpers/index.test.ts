import { describe, expect, it, vi } from 'vitest';

const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { name: null as string | null, factory: null as unknown };
  const moduleApi = {
    name: 'portainer.app.helpers',
    factory: vi.fn((name: string, factory: unknown) => {
      factoryState.name = name;
      factoryState.factory = factory;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { factoryState, angularMock, moduleApi };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

vi.mock('./webhookHelper', () => ({
  WebhookHelperFactory: vi.fn(() => ({ returnWebhookUrl: vi.fn() })),
}));

describe('helpersModule angular registration', () => {
  it('registers WebhookHelper on portainer.app.helpers', async () => {
    const { helpersModule } = await import('./index');
    expect(angularMock.module).toHaveBeenCalledWith('portainer.app.helpers', []);
    expect(factoryState.name).toBe('WebhookHelper');
    expect(factoryState.factory).toBeTypeOf('function');
    expect(helpersModule).toBe('portainer.app.helpers');
  });
});
