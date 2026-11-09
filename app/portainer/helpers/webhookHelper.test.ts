import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  API_ENDPOINT_STACKS,
  API_ENDPOINT_WEBHOOKS,
} from '@/constants';

async function loadWebhookHelper(location: {
  protocol: string;
  hostname: string;
  port: string;
}, href = '/') {
  vi.resetModules();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: location,
  });
  vi.doMock('uuid', () => ({
    default: vi.fn(() => 'webhook-uuid-1'),
  }));
  vi.doMock('./pathHelper', () => ({
    baseHref: vi.fn(() => href),
  }));
  return import('./webhookHelper');
}

describe('REQ-STK-09 webhookHelper Docker and stack webhook URLs', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.resetModules();
    vi.doUnmock('uuid');
    vi.doUnmock('./pathHelper');
  });

  it('createWebhookId returns a uuid token', async () => {
    const mod = await loadWebhookHelper({
      protocol: 'http:',
      hostname: 'localhost',
      port: '9000',
    });
    expect(mod.createWebhookId()).toBe('webhook-uuid-1');
  });

  it('dockerWebhookUrl and stack webhook URLs include host, non-default port and base href', async () => {
    const mod = await loadWebhookHelper(
      {
        protocol: 'https:',
        hostname: 'portainer.example',
        port: '9443',
      },
      '/'
    );
    expect(mod.dockerWebhookUrl('tok')).toBe(
      `https://portainer.example:9443/${API_ENDPOINT_WEBHOOKS}/tok`
    );
    expect(mod.baseStackWebhookUrl()).toBe(
      `https://portainer.example:9443/${API_ENDPOINT_STACKS}/webhooks`
    );
    expect(mod.stackWebhookUrl('stk')).toBe(
      `https://portainer.example:9443/${API_ENDPOINT_STACKS}/webhooks/stk`
    );
  });

  it('omits the port for default https 443', async () => {
    const mod = await loadWebhookHelper(
      {
        protocol: 'https:',
        hostname: 'portainer.example',
        port: '443',
      },
      '/app/'
    );
    expect(mod.dockerWebhookUrl('t')).toBe(
      `https://portainer.example/app/${API_ENDPOINT_WEBHOOKS}/t`
    );
  });

  it('omits the port for default http 80', async () => {
    const mod = await loadWebhookHelper({
      protocol: 'http:',
      hostname: 'localhost',
      port: '80',
    });
    expect(mod.dockerWebhookUrl('t')).toBe(
      `http://localhost/${API_ENDPOINT_WEBHOOKS}/t`
    );
  });

  it('omits the port when window.location.port is empty', async () => {
    const mod = await loadWebhookHelper({
      protocol: 'https:',
      hostname: 'portainer.example',
      port: '',
    });
    expect(mod.dockerWebhookUrl('t')).toBe(
      `https://portainer.example/${API_ENDPOINT_WEBHOOKS}/t`
    );
  });

  it('uses baseHref alone when the page protocol is file', async () => {
    const mod = await loadWebhookHelper(
      {
        protocol: 'file:',
        hostname: '',
        port: '',
      },
      '/local/'
    );
    expect(mod.dockerWebhookUrl('f')).toBe(`/local/${API_ENDPOINT_WEBHOOKS}/f`);
  });

  it('WebhookHelperFactory exposes the Docker and stack URL helpers', async () => {
    const mod = await loadWebhookHelper({
      protocol: 'http:',
      hostname: 'localhost',
      port: '9000',
    });
    const factory = mod.WebhookHelperFactory();
    expect(factory.returnWebhookUrl('x')).toBe(mod.dockerWebhookUrl('x'));
    expect(factory.getBaseStackWebhookUrl()).toBe(mod.baseStackWebhookUrl());
    expect(factory.returnStackWebhookUrl('y')).toBe(mod.stackWebhookUrl('y'));
  });
});
