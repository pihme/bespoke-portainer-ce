import { describe, expect, it } from 'vitest';

import { azureHandlers } from './azure';
import { dockerHandlers } from './docker';
import { edgeHandlers } from './edge';
import { endpointsHandlers } from './endpoints';
import { gitopsHandlers } from './gitops';
import { settingsHandlers } from './settings';
import { templatesHandlers } from './templates';
import { dockerImagesHandlers } from './docker/images';

async function get(path: string) {
  const res = await fetch(path);
  expect(res.ok, `${path} -> ${res.status}`).toBe(true);
  return res.json();
}

describe('shared frontend setup HTTP handlers', () => {
  it('exports handler arrays used by the suite', () => {
    expect(azureHandlers.length).toBeGreaterThan(0);
    expect(dockerHandlers.length).toBeGreaterThan(0);
    expect(edgeHandlers.length).toBeGreaterThan(0);
    expect(endpointsHandlers.length).toBeGreaterThan(0);
    expect(gitopsHandlers.length).toBeGreaterThan(0);
    expect(settingsHandlers.length).toBeGreaterThan(0);
    expect(templatesHandlers.length).toBeGreaterThan(0);
    expect(dockerImagesHandlers.length).toBeGreaterThan(0);
  });

  it('serves local Docker and endpoint stubs', async () => {
    await expect(get('/api/endpoints')).resolves.toEqual([]);
    await expect(get('/api/endpoints/agent_versions')).resolves.toEqual([]);
    const env = await get('/api/endpoints/1');
    expect(env.Id).toBe(1);
    await expect(get('/api/endpoints/1/registries')).resolves.toEqual([]);
    await expect(get('/api/endpoints/1/registries/2')).resolves.toEqual({});

    await expect(get('/api/endpoints/1/docker/info')).resolves.toMatchObject({
      NCPU: 0,
    });
    await expect(get('/api/endpoints/1/docker/version')).resolves.toEqual({
      ApiVersion: '1.24',
    });
    await expect(
      get('/api/endpoints/1/docker/containers/json')
    ).resolves.toEqual([]);
    await expect(get('/api/endpoints/1/docker/networks')).resolves.toEqual([]);
    await expect(get('/api/docker/1/images')).resolves.toEqual([]);
    await expect(get('/api/endpoints/1/docker/images/json')).resolves.toEqual(
      []
    );
  });

  it('serves settings and template stubs', async () => {
    await expect(get('/api/ssl')).resolves.toEqual({});
    await expect(get('/api/settings')).resolves.toEqual({});
    await expect(get('/api/settings/edge/mtls_certificate')).resolves.toEqual(
      {}
    );
    await expect(
      get('/api/settings/edge/mtls_ca_certificate')
    ).resolves.toEqual({});
    await expect(
      get('/api/settings/additional_functionality')
    ).resolves.toEqual({});
    await expect(get('/api/support/debug_log')).resolves.toEqual({});
    const pub = await get('/api/settings/public');
    expect(pub.Features).toEqual({});

    await expect(get('/api/custom_templates')).resolves.toEqual([]);
    const fetchRes = await fetch('/api/custom_templates/1/git_fetch', {
      method: 'PUT',
    });
    expect(fetchRes.ok).toBe(true);
    await expect(fetchRes.json()).resolves.toEqual({ FileContent: '' });
  });

  it('serves gitops stubs for local sources', async () => {
    const refs = await fetch('/api/gitops/repo/refs', { method: 'POST' });
    expect(refs.ok).toBe(true);
    await expect(refs.json()).resolves.toContain('refs/heads/main');

    const files = await fetch('/api/gitops/repo/files/search', {
      method: 'POST',
    });
    expect(files.ok).toBe(true);
    await expect(files.json()).resolves.toEqual(['docker-compose.yml']);

    await expect(get('/api/gitops/sources')).resolves.toEqual([]);
    const source = await get('/api/gitops/sources/7');
    expect(source).toMatchObject({ id: 7, type: 'git' });
    await expect(get('/api/gitops/sources/7/workflows')).resolves.toEqual([]);
  });

  it('serves azure and edge stubs used by the suite', async () => {
    const subs = await get('/api/endpoints/1/azure/subscriptions');
    expect(subs.value[0].subscriptionId).toBe('sub1');

    const provider = await get(
      '/api/endpoints/1/azure/subscriptions/sub1/providers/Microsoft.ContainerInstance'
    );
    expect(provider.namespace).toBe('Microsoft.ContainerInstance');

    await expect(
      get(
        '/api/endpoints/1/azure/subscriptions/sub1/providers/Microsoft.ContainerInstance/containerGroups'
      )
    ).resolves.toEqual({ value: [] });
    await expect(
      get(
        '/api/endpoints/1/azure/subscriptions/sub1/providers/Microsoft.Network/virtualNetworks'
      )
    ).resolves.toEqual({ value: [] });
    const rgs = await get(
      '/api/endpoints/1/azure/subscriptions/sub1/resourcegroups'
    );
    expect(rgs.value).toHaveLength(2);

    await expect(get('/api/edge_configurations')).resolves.toEqual([]);
    await expect(get('/api/edge_configurations/1')).resolves.toEqual({});
    await expect(get('/api/edge_update_schedules')).resolves.toEqual([]);
    await expect(get('/api/edge_update_schedules/1')).resolves.toEqual({});
    await expect(get('/api/edge_groups')).resolves.toEqual([]);
    await expect(get('/api/edge_jobs')).resolves.toEqual([]);
    await expect(get('/api/edge_jobs/1')).resolves.toEqual({});
    await expect(get('/api/edge_jobs/1/file')).resolves.toEqual({
      FileContent: '',
    });
    await expect(get('/api/edge_stacks')).resolves.toEqual([]);
    await expect(get('/api/edge_stacks/1')).resolves.toEqual({});
    await expect(get('/api/edge_stacks/1/stagger/status')).resolves.toEqual({
      status: 'idle',
    });
    await expect(get('/api/edge_stacks/1/file')).resolves.toEqual({
      StackFileContent: '',
    });
  });
});
