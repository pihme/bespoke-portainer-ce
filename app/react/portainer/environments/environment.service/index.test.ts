import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';
import {
  ContainerEngine,
  EnvironmentStatus,
  EnvironmentType,
} from '../types';

const endpointList = vi.fn();

vi.mock('@api/sdk.gen', () => ({
  endpointList: (...args: unknown[]) => endpointList(...args),
}));

import {
  deleteEndpoint,
  disassociateEndpoint,
  getDeploymentOptions,
  getEndpoint,
  getEnvironmentSummaryCounts,
  getEnvironments,
  snapshotEndpoint,
  snapshotEndpoints,
  updateSettings,
} from './index';

function endpointPayload(overrides: Record<string, unknown> = {}) {
  return {
    Id: 7,
    Name: 'local',
    Type: EnvironmentType.Docker,
    Status: EnvironmentStatus.Up,
    ContainerEngine: ContainerEngine.Docker,
    Kubernetes: { Configuration: { StorageClasses: [], IngressClasses: [] } },
    DeploymentOptions: {
      hideAddWithForm: true,
      hideFileUpload: false,
      hideWebEditor: false,
      overrideGlobalOptions: true,
    },
    ...overrides,
  };
}

describe('environment.service local Docker reads (backwards compatibility)', () => {
  beforeEach(() => {
    endpointList.mockReset();
  });

  it('getEnvironments returns an empty page when tagIds or endpointIds are empty', async () => {
    await expect(
      getEnvironments({ query: { tagIds: [] } })
    ).resolves.toEqual({
      totalCount: 0,
      value: [],
      totalAvailable: 0,
      updateAvailable: false,
    });
    expect(endpointList).not.toHaveBeenCalled();

    await expect(
      getEnvironments({ query: { endpointIds: [] } })
    ).resolves.toMatchObject({ totalCount: 0, value: [] });
  });

  it('getEnvironments maps endpointList results and headers', async () => {
    endpointList.mockResolvedValue({
      data: [endpointPayload()],
      headers: {
        'x-total-count': '4',
        'x-total-available': '9',
        'x-update-available': 'true',
      },
    });

    const result = await getEnvironments({
      start: 1,
      limit: 10,
      sort: { by: 'Name', order: 'desc' },
      query: { types: [EnvironmentType.Docker], search: 'local' },
    });

    expect(endpointList).toHaveBeenCalledWith({
      query: expect.objectContaining({
        start: 1,
        limit: 10,
        sort: 'Name',
        order: 'desc',
        search: 'local',
        types: [EnvironmentType.Docker],
      }),
    });
    expect(result.totalCount).toBe(4);
    expect(result.totalAvailable).toBe(9);
    expect(result.updateAvailable).toBe(true);
    expect(result.value[0].Name).toBe('local');
  });

  it('getEnvironments defaults headers when missing and maps null data', async () => {
    endpointList.mockResolvedValue({ data: null, headers: {} });
    const result = await getEnvironments();
    expect(result).toEqual({
      totalCount: 0,
      value: [],
      totalAvailable: 0,
      updateAvailable: false,
    });
  });

  it('REQ-TAI-013 offers no endpointsByGroup helper', async () => {
    const service = await import('./index');
    expect(service).not.toHaveProperty('endpointsByGroup');
  });

  it('getEndpoint loads and maps a single environment', async () => {
    server.use(
      http.get('/api/endpoints/:id', ({ request }) => {
        expect(new URL(request.url).searchParams.get('excludeSnapshot')).toBe(
          'true'
        );
        return HttpResponse.json(endpointPayload());
      })
    );
    const env = await getEndpoint(7);
    expect(env.Id).toBe(7);
    expect(env.Name).toBe('local');
  });

  it('getEndpoint surfaces axios errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/:id', () =>
        HttpResponse.json({ message: 'missing' }, { status: 404 })
      )
    );
    await expect(getEndpoint(99)).rejects.toBeTruthy();
    restore();
  });

  it('snapshotEndpoints and snapshotEndpoint post snapshot routes', async () => {
    let allHit = false;
    let oneHit = false;
    server.use(
      http.post('/api/endpoints/snapshot', () => {
        allHit = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('/api/endpoints/:id/snapshot', () => {
        oneHit = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    await snapshotEndpoints();
    await snapshotEndpoint(7);
    expect(allHit).toBe(true);
    expect(oneHit).toBe(true);
  });

  it('deleteEndpoint and disassociateEndpoint call delete routes', async () => {
    let deleted = false;
    let disassociated = false;
    server.use(
      http.delete('/api/endpoints/:id', () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete('/api/endpoints/:id/association', () => {
        disassociated = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    await deleteEndpoint(7);
    await disassociateEndpoint(7);
    expect(deleted).toBe(true);
    expect(disassociated).toBe(true);
  });

  it('updateSettings puts security settings for an environment', async () => {
    let body: unknown;
    server.use(
      http.put('/api/endpoints/:id/settings', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );
    await updateSettings(7, {
      enableHostManagementFeatures: true,
    } as never);
    expect(body).toEqual({ enableHostManagementFeatures: true });
  });

  it('getEnvironmentSummaryCounts reads the list summary', async () => {
    server.use(
      http.get('/api/endpoints/summary', () =>
        HttpResponse.json({ total: 2, up: 1, down: 1 })
      )
    );
    await expect(getEnvironmentSummaryCounts()).resolves.toMatchObject({
      total: 2,
    });
  });

  it('getDeploymentOptions returns global options because CE toEnvironment clears per-env overrides', async () => {
    server.use(
      http.get('/api/settings/public', () =>
        HttpResponse.json({
          GlobalDeploymentOptions: {
            perEnvOverride: true,
            hideAddWithForm: false,
            hideFileUpload: true,
            hideWebEditor: false,
          },
        })
      ),
      http.get('/api/endpoints/:id', () =>
        HttpResponse.json(
          endpointPayload({
            DeploymentOptions: {
              overrideGlobalOptions: true,
              hideAddWithForm: true,
            },
          })
        )
      )
    );
    const opts = await getDeploymentOptions(7);
    // CE toEnvironment hardcodes DeploymentOptions.overrideGlobalOptions=false (EE-only field).
    expect(opts).toMatchObject({ hideFileUpload: true, hideAddWithForm: false });
  });

  it('surfaces errors from summary and snapshot helpers', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/summary', () =>
        HttpResponse.json({ message: 'no' }, { status: 500 })
      ),
      http.post('/api/endpoints/snapshot', () =>
        HttpResponse.json({ message: 'no' }, { status: 500 })
      ),
      http.post('/api/endpoints/:id/snapshot', () =>
        HttpResponse.json({ message: 'no' }, { status: 500 })
      ),
      http.delete('/api/endpoints/:id', () =>
        HttpResponse.json({ message: 'no' }, { status: 500 })
      ),
      http.delete('/api/endpoints/:id/association', () =>
        HttpResponse.json({ message: 'no' }, { status: 500 })
      ),
      http.put('/api/endpoints/:id/settings', () =>
        HttpResponse.json({ message: 'no' }, { status: 500 })
      )
    );
    await expect(getEnvironmentSummaryCounts()).rejects.toBeTruthy();
    await expect(snapshotEndpoints()).rejects.toBeTruthy();
    await expect(snapshotEndpoint(1)).rejects.toBeTruthy();
    await expect(deleteEndpoint(1)).rejects.toBeTruthy();
    await expect(disassociateEndpoint(1)).rejects.toBeTruthy();
    await expect(updateSettings(1, {} as never)).rejects.toBeTruthy();
    restore();
  });
});
