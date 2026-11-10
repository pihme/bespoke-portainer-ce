import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, Fragment } from 'react';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { useApiVersion, useVersion } from './useVersion';
import {
  useInfo,
  useIsStandalone,
  useIsWindows,
  useSystemLimits,
} from './useInfo';
import * as useInfoModule from './useInfo';
import {
  useLoggingPlugins,
  useNetworkPlugins,
  useServicePlugins,
  useVolumePlugins,
} from './usePlugins';
import { useEvents } from './useEvents';
import { useImages } from './images/useImages';
import { useCommitContainerMutation } from './useCommitContainerMutation';

function wrapHook<T>(fn: () => T) {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(fn, { wrapper: Wrapper });
}

function mockInfo(body: Record<string, unknown>) {
  server.use(
    http.get('/api/endpoints/:id/docker/info', () => HttpResponse.json(body))
  );
}

describe('useInfo helpers (backwards compatibility)', () => {
  it('useInfo returns system info when an environment id is set', async () => {
    mockInfo({ OSType: 'linux', NCPU: 8 });
    const { result } = wrapHook(() => useInfo(1));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ OSType: 'linux', NCPU: 8 });
  });

  it('useInfo stays disabled without an environment id', () => {
    const { result } = wrapHook(() => useInfo(undefined));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useIsWindows is true only for windows OSType', async () => {
    mockInfo({ OSType: 'windows' });
    const { result } = wrapHook(() => useIsWindows(1));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('useIsStandalone is true when Swarm NodeID is absent', async () => {
    mockInfo({ Swarm: {} });
    const { result } = wrapHook(() => useIsStandalone(1));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('REQ-TAI-003 treats a Swarm member as a standalone Docker engine', async () => {
    mockInfo({ Swarm: { NodeID: 'node-1', ControlAvailable: true } });
    const { result } = wrapHook(() => useIsStandalone(1));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('REQ-TAI-017 has no Swarm hooks', () => {
    const mod: Record<string, unknown> = useInfoModule;
    expect(mod).not.toHaveProperty('useIsSwarm');
    expect(mod).not.toHaveProperty('useIsSwarmManager');
  });

  it('useSystemLimits derives maxCpu and maxMemory from info with defaults', async () => {
    mockInfo({ NCPU: 4, MemTotal: 2_000_000_000 });
    const { result, rerender } = wrapHook(() => useSystemLimits(1));
    await waitFor(() => expect(result.current.maxCpu).toBe(4));
    expect(result.current.maxMemory).toBe(2000);

    mockInfo({});
    // fresh hook instance for defaults path
    const { result: defaults } = wrapHook(() => useSystemLimits(2));
    await waitFor(() => expect(defaults.current.maxCpu).toBe(32));
    expect(defaults.current.maxMemory).toBe(32768);
    void rerender;
  });
});

describe('useVersion helpers (backwards compatibility)', () => {
  it('useVersion returns version data and useApiVersion parses ApiVersion', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/version', () =>
        HttpResponse.json({ ApiVersion: '1.44', Version: '27.0.0' })
      )
    );
    const { result } = wrapHook(() => ({
      version: useVersion(3),
      api: useApiVersion(3),
    }));
    await waitFor(() => expect(result.current.version.isSuccess).toBe(true));
    expect(result.current.version.data?.ApiVersion).toBe('1.44');
    await waitFor(() => expect(result.current.api).toBe(1.44));
  });

  it('useApiVersion returns 0 when there is no environment id', () => {
    const { result } = wrapHook(() => useApiVersion(undefined));
    expect(result.current).toBe(0);
  });
});

describe('useEvents and useImages hooks (backwards compatibility)', () => {
  it('useEvents loads events for the environment', async () => {
    server.use(
      http.get(
        '/api/endpoints/:id/docker/events',
        () =>
          new HttpResponse('{"Type":"container","Action":"create"}', {
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );
    const { result } = wrapHook(() => useEvents(4));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      { Type: 'container', Action: 'create' },
    ]);
  });

  it('useImages loads the image list', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/images/json', () =>
        HttpResponse.json([{ Id: 'sha256:x', RepoTags: ['busybox:latest'] }])
      )
    );
    const { result } = wrapHook(() => useImages(5));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].RepoTags).toEqual(['busybox:latest']);
  });
});

describe('plugin hooks (backwards compatibility)', () => {
  it('useVolumePlugins merges system volume plugins when systemOnly', async () => {
    mockInfo({ Plugins: { Volume: ['local'] } });
    const { result } = wrapHook(() => useVolumePlugins(6, true));
    await waitFor(() => expect(result.current.data).toEqual(['local']));
  });

  it('useNetworkPlugins and useLoggingPlugins expose network and log plugins', async () => {
    mockInfo({ Plugins: { Network: ['bridge'], Log: ['json-file'] } });
    server.use(
      http.get('/api/endpoints/:id/docker/plugins', () => HttpResponse.json([]))
    );
    const { result } = wrapHook(() => ({
      network: useNetworkPlugins(7, true),
      logging: useLoggingPlugins(7, true),
      loggingPodman: useLoggingPlugins(7, false, true),
      both: useServicePlugins(7, false, 'Log'),
    }));
    await waitFor(() =>
      expect(result.current.network.data).toEqual(['bridge'])
    );
    expect(result.current.logging.data).toEqual(['json-file']);
    expect(result.current.loggingPodman.data).toEqual(['json-file']);
  });
});

describe('useCommitContainerMutation (backwards compatibility)', () => {
  it('commits a container image without a registry', async () => {
    server.use(
      http.post('/api/endpoints/:id/docker/commit', () =>
        HttpResponse.json({ Id: 'sha256:committed' })
      ),
      http.get('/api/endpoints/:id/docker/containers/:containerId/json', () =>
        HttpResponse.json({ Id: 'c1' })
      )
    );

    const { result } = wrapHook(() => useCommitContainerMutation(8));
    result.current.mutate({
      environmentId: 8,
      containerId: 'c1',
      image: 'myimg:latest',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ Id: 'sha256:committed' });
  });

  it('REQ-TAI-005 commits with the typed image name, no registry prefix', async () => {
    let requestUrl = '';
    server.use(
      http.post('/api/endpoints/:id/docker/commit', ({ request }) => {
        requestUrl = request.url;
        return HttpResponse.json({ Id: 'sha256:reg' });
      })
    );

    const { result } = wrapHook(() => useCommitContainerMutation(8));
    result.current.mutate({
      environmentId: 8,
      containerId: 'c1',
      image: 'registry.local:5000/myimg:2',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const params = new URL(requestUrl).searchParams;
    expect(params.get('repo')).toBe('registry.local:5000/myimg');
    expect(params.get('tag')).toBe('2');
  });
});
