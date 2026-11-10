import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { buildUrl } from './build-url';
import { queryKeys } from './query-keys';
import { useNodesCount } from './useNodesCount';
import { useSystemInfo } from './useSystemInfo';
import { getSystemStatus, useSystemStatus } from './useSystemStatus';
import { getSystemVersion, useSystemVersion } from './useSystemVersion';

vi.mock('@/react/portainer/feature-flags/feature-flags.service', () => ({
  isBE: false,
}));

const wrapper = withTestQueryProvider(({ children }) => <>{children}</>);

describe('REQ-ENV-02 system helpers', () => {
  it('buildUrl and queryKeys shape system routes', () => {
    expect(buildUrl()).toBe('/system');
    expect(buildUrl('status')).toBe('/system/status');
    expect(queryKeys.base()).toEqual(['system']);
  });

  it('useNodesCount returns the node count', async () => {
    server.use(
      http.get('/api/system/nodes', () => HttpResponse.json({ nodes: 4 }))
    );

    const { result } = renderHook(() => useNodesCount(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(4);
  });

  it('useNodesCount surfaces fetch errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/system/nodes', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useNodesCount(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });

  it('useSystemInfo returns platform agents', async () => {
    server.use(
      http.get('/api/system/info', () =>
        HttpResponse.json({
          platform: 'Docker Standalone',
          agents: 1,
          edgeAgents: 0,
        })
      )
    );

    const { result } = renderHook(() => useSystemInfo(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      platform: 'Docker Standalone',
      agents: 1,
      edgeAgents: 0,
    });
  });

  it('useSystemInfo surfaces fetch errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/system/info', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useSystemInfo(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });

  it('getSystemStatus forces Community Edition when not BE', async () => {
    server.use(
      http.get('/api/system/status', () =>
        HttpResponse.json({
          Edition: 'whatever',
          Version: '2.45.0',
          InstanceID: 'abc',
        })
      )
    );

    await expect(getSystemStatus()).resolves.toEqual({
      Edition: 'Community Edition',
      Version: '2.45.0',
      InstanceID: 'abc',
    });
  });

  it('useSystemStatus supports select enabled and onSuccess', async () => {
    server.use(
      http.get('/api/system/status', () =>
        HttpResponse.json({
          Edition: 'x',
          Version: '2.45.0',
          InstanceID: 'id',
        })
      )
    );
    const onSuccess = vi.fn();

    const { result } = renderHook(
      () =>
        useSystemStatus({
          select: (s) => s.Version,
          enabled: true,
          retry: false,
          onSuccess,
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('2.45.0');
    expect(onSuccess).toHaveBeenCalledWith('2.45.0');
  });

  it('getSystemStatus surfaces errors', async () => {
    server.use(
      http.get('/api/system/status', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );
    await expect(getSystemStatus()).rejects.toThrow();
  });

  it('useSystemVersion returns version payload', async () => {
    const payload = {
      UpdateAvailable: false,
      LatestVersion: '2.45.0',
      ServerVersion: '2.45.0',
      VersionSupport: 'LTS',
      DatabaseVersion: '100',
      Build: {
        BuildNumber: '1',
        ImageTag: 'latest',
        NodejsVersion: '22',
        PnpmVersion: '9',
        WebpackVersion: '5',
        GoVersion: '1.26',
        GitCommit: 'abc',
      },
      Dependencies: {
        DockerVersion: '27',
        HelmVersion: '3',
        KubectlVersion: '1.30',
        ComposeVersion: '2',
      },
      Runtime: {},
    };
    server.use(
      http.get('/api/system/version', () => HttpResponse.json(payload))
    );

    const { result } = renderHook(() => useSystemVersion(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
    await expect(getSystemVersion()).resolves.toEqual(payload);
  });

  it('getSystemVersion surfaces errors', async () => {
    server.use(
      http.get('/api/system/version', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );
    await expect(getSystemVersion()).rejects.toThrow();
  });
});
