import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mockQ, promiseResource, rejectResource } from './angularFactoryHelpers.test.js';

const { factoryState, angularMock } = vi.hoisted(() => {
  const factoryState = { factory: null };
  const moduleApi = {
    factory: vi.fn((_name, depsOrFn) => {
      factoryState.factory = Array.isArray(depsOrFn) ? depsOrFn[depsOrFn.length - 1] : depsOrFn;
      return moduleApi;
    }),
    service: vi.fn((_name, fn) => {
      factoryState.factory = fn;
      return moduleApi;
    }),
  };
  const angularMock = { module: vi.fn(() => moduleApi) };
  globalThis.angular = angularMock;
  return { factoryState, angularMock };
});

vi.mock('angular', () => ({
  default: angularMock,
  module: angularMock.module,
}));

await import('./webhookService.js');

describe('WebhookService Docker service webhooks', () => {
  beforeEach(() => vi.clearAllMocks());

  function build(Webhooks) {
    return factoryState.factory(mockQ(), Webhooks);
  }

  it('webhooks maps API rows into WebhookViewModel', async () => {
    const Webhooks = {
      query: vi.fn(() =>
        promiseResource([
          { Id: 1, Token: 'tok', ResourceID: 'svc', EndpointID: 3, WebhookType: 1 },
        ])
      ),
      create: vi.fn(() => promiseResource({ Id: 2 })),
      update: vi.fn(() => promiseResource({})),
      remove: vi.fn(() => promiseResource({})),
    };
    const service = build(Webhooks);
    const list = await service.webhooks('svc', 3);
    expect(Webhooks.query).toHaveBeenCalledWith({
      filters: { ResourceID: 'svc', EndpointID: 3 },
    });
    expect(list[0].Token).toBe('tok');
    expect(list[0].ResourceId).toBe('svc');
  });

  it('webhooks rejects with a clear message on failure', async () => {
    const service = build({ query: vi.fn(() => rejectResource(new Error('x'))) });
    await expect(service.webhooks('svc', 1)).rejects.toMatchObject({
      msg: 'Unable to retrieve webhooks',
    });
  });

  it('createServiceWebhook, updateServiceWebhook and deleteWebhook forward to Webhooks', async () => {
    const Webhooks = {
      query: vi.fn(),
      create: vi.fn(() => promiseResource({ Id: 9 })),
      update: vi.fn(() => promiseResource({ Id: 9 })),
      remove: vi.fn(() => promiseResource({})),
    };
    const service = build(Webhooks);
    await service.createServiceWebhook('svc', 1, 4);
    await service.updateServiceWebhook(9, 5);
    await service.deleteWebhook(9);
    expect(Webhooks.create).toHaveBeenCalledWith({
      ResourceID: 'svc',
      EndpointID: 1,
      WebhookType: 1,
      registryID: 4,
    });
    expect(Webhooks.update).toHaveBeenCalledWith({ id: 9, registryID: 5 });
    expect(Webhooks.remove).toHaveBeenCalledWith({ id: 9 });
  });
});
