import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, Fragment } from 'react';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { createMockEnvironment } from '@/react-tools/test-mocks';
import {
  ContainerEngine,
  EnvironmentStatus,
  PlatformType,
} from '@/react/portainer/environments/types';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { environmentQueryKeys } from './query-keys';
import { useEnvironment } from './useEnvironment';
import {
  getSortType,
  getSortTypeCaseInsensitive,
  isSortType,
  refetchIfAnyOffline,
  useEnvironmentList,
  ENVIRONMENTS_POLLING_INTERVAL,
} from './useEnvironmentList';
import { useBaseApiQueryParams } from './useBaseApiQueryParams';
import { useAvailableSortGroups } from './useAvailableSortGroups';
import { useEnvironmentSummaryCounts } from './useEnvironmentSummaryCounts';
import { useDeleteEnvironmentsMutation } from './useDeleteEnvironmentsMutation';
import {
  updateEnvironment,
  useUpdateEnvironmentMutation,
} from './useUpdateEnvironmentMutation';
import { useIsPodman } from './useIsPodman';
import { useAgentDetails } from './useAgentDetails';

function wrapHook<T>(fn: () => T) {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(fn, { wrapper: Wrapper });
}

describe('REQ-ENV-01 local environment query helpers', () => {
  it('builds environment query keys', () => {
    expect(environmentQueryKeys.base()).toEqual(['environments']);
    expect(environmentQueryKeys.item(3)).toEqual(['environments', 3]);
    expect(environmentQueryKeys.registries(3, 'ns')).toEqual([
      'environments',
      3,
      'registries',
      'ns',
    ]);
  });

  it('validates and normalizes sort types', () => {
    expect(isSortType('Name')).toBe(true);
    expect(isSortType('Nope')).toBe(false);
    expect(getSortType('Group')).toBe('Group');
    expect(getSortType('x')).toBeUndefined();
    expect(getSortTypeCaseInsensitive('name')).toBe('Name');
    expect(getSortTypeCaseInsensitive()).toBeUndefined();
  });

  it('refetchIfAnyOffline polls only when an environment is down', () => {
    expect(refetchIfAnyOffline()).toBe(false);
    expect(
      refetchIfAnyOffline({
        value: [createMockEnvironment({ Status: EnvironmentStatus.Up })],
        totalCount: 1,
        totalAvailable: 1,
        updateAvailable: false,
      })
    ).toBe(false);
    expect(
      refetchIfAnyOffline({
        value: [createMockEnvironment({ Status: EnvironmentStatus.Down })],
        totalCount: 1,
        totalAvailable: 1,
        updateAvailable: false,
      })
    ).toBe(ENVIRONMENTS_POLLING_INTERVAL);
  });

  it('useBaseApiQueryParams maps search for CE', () => {
    const { result } = wrapHook(() => useBaseApiQueryParams('docker'));
    expect(result.current).toMatchObject({
      provisioned: true,
      updateInformation: false,
      k8sEnvAdmin: true,
      search: 'docker',
    });
    const empty = wrapHook(() => useBaseApiQueryParams(''));
    expect(empty.result.current.search).toBeUndefined();
  });
});

describe('REQ-ENV-01 useEnvironment and list', () => {
  it('loads a single local environment', async () => {
    const env = createMockEnvironment({ Id: 9, Name: 'local-docker' });
    server.use(http.get('/api/endpoints/9', () => HttpResponse.json(env)));
    const { result } = wrapHook(() => useEnvironment(9));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.Name).toBe('local-docker');
  });

  it('stays disabled without an environment id', () => {
    const { result } = wrapHook(() => useEnvironment(undefined));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('lists environments and filters docker vs podman platforms', async () => {
    const docker = createMockEnvironment({
      Id: 1,
      Name: 'd1',
      ContainerEngine: ContainerEngine.Docker,
    });
    const podman = createMockEnvironment({
      Id: 2,
      Name: 'p1',
      ContainerEngine: ContainerEngine.Podman,
    });
    server.use(
      http.get('/api/endpoints', () =>
        HttpResponse.json([docker, podman], {
          headers: {
            'x-total-count': '2',
            'x-total-available': '2',
          },
        })
      )
    );

    const all = wrapHook(() => useEnvironmentList());
    await waitFor(() => expect(all.result.current.isLoading).toBe(false));
    expect(all.result.current.environments).toHaveLength(2);

    const dockerOnly = wrapHook(() =>
      useEnvironmentList({
        platformTypes: [PlatformType.Docker],
      })
    );
    await waitFor(() =>
      expect(dockerOnly.result.current.isLoading).toBe(false)
    );
    expect(
      dockerOnly.result.current.environments.every(
        (e) => e.ContainerEngine === ContainerEngine.Docker
      )
    ).toBe(true);
  });

  it('useIsPodman selects the container engine', async () => {
    server.use(
      http.get('/api/endpoints/4', () =>
        HttpResponse.json(
          createMockEnvironment({
            Id: 4,
            ContainerEngine: ContainerEngine.Podman,
          })
        )
      )
    );
    const { result } = wrapHook(() => useIsPodman(4));
    await waitFor(() => expect(result.current).toBe(true));
  });
});

describe('REQ-ENV-01 summary and sort groups', () => {
  it('loads summary counts and builds docker/podman group options', async () => {
    server.use(
      http.get('/api/endpoints/summary', () =>
        HttpResponse.json({
          total: 2,
          byGroup: [{ groupID: 1, groupName: 'Unassigned', count: 2 }],
          byPlatformType: { docker: 1, podman: 1, kubernetes: 0, azure: 0 },
          byHealth: { up: 2, down: 0, outdated: 0, heartbeat: 0 },
        })
      )
    );

    const summary = wrapHook(() => useEnvironmentSummaryCounts());
    await waitFor(() => expect(summary.result.current.isSuccess).toBe(true));

    const groups = wrapHook(() =>
      useAvailableSortGroups(summary.result.current.data)
    );
    expect(groups.result.current.Group[0].label).toBe('Unassigned');
    expect(groups.result.current.PlatformType.map((p) => p.key)).toEqual(
      expect.arrayContaining(['Docker', 'Podman'])
    );
    expect(
      groups.result.current.PlatformType.find((p) => p.key === 'Kubernetes')
    ).toBeUndefined();
  });

  it('returns empty sort groups without summary data', () => {
    const { result } = wrapHook(() => useAvailableSortGroups(undefined));
    expect(result.current.Group).toEqual([]);
    expect(result.current.PlatformType).toEqual([]);
  });
});

describe('REQ-ENV-03 local environment mutations', () => {
  it('deletes environments', async () => {
    let deleted: string | undefined;
    server.use(
      http.delete('/api/endpoints/:id', ({ params }) => {
        deleted = String(params.id);
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { result } = wrapHook(() => useDeleteEnvironmentsMutation());
    result.current.mutate([8]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleted).toBe('8');
  });

  it('updates an environment without TLS files', async () => {
    server.use(
      http.put('/api/endpoints/:id', async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json(
          createMockEnvironment({
            Id: 5,
            Name: (body as { Name?: string }).Name ?? 'updated',
          })
        );
      })
    );
    const updated = await updateEnvironment({
      id: 5,
      payload: { Name: 'renamed' },
    });
    expect(updated.Name).toBe('renamed');

    const { result } = wrapHook(() => useUpdateEnvironmentMutation());
    result.current.mutate({ id: 5, payload: { Name: 'via-hook' } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('surfaces update errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.put('/api/endpoints/:id', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 })
      )
    );
    await expect(
      updateEnvironment({ id: 1, payload: { Name: 'x' } })
    ).rejects.toBeTruthy();
    restore();
  });
});

describe('useAgentDetails (backwards compatibility)', () => {
  it('returns agent version and secret when settings and status load', async () => {
    server.use(
      http.get('/api/settings', () =>
        HttpResponse.json({ AgentSecret: 'sekrit' })
      ),
      http.get('/api/system/status', () =>
        HttpResponse.json({ Version: '2.45.3' })
      )
    );
    const { result } = wrapHook(() => useAgentDetails());
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual({
      agentVersion: '2.45.3',
      agentSecret: 'sekrit',
    });
  });
});
