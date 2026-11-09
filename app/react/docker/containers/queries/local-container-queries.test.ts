import { http, HttpResponse } from 'msw';
import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { createElement, Fragment } from 'react';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { queryKeys } from './query-keys';
import { getContainers, useContainers } from './useContainers';
import { inspectContainer, useContainerInspect } from './useContainerInspect';
import { getContainer, useContainer, invalidateContainer } from './useContainer';
import { updateContainer } from './useUpdateContainer';
import { createExec } from './useCreateExecMutation';
import { resizeTTY } from './useContainerResizeTTYMutation';
import { getContainerTop, useContainerTop } from './useContainerTop';
import { useContainerGpus } from './gpus';
import { useRenameContainer } from './useRenameContainer';

function wrapHook<T>(fn: () => T) {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(fn, { wrapper: Wrapper });
}

describe('REQ-CTR local container queries', () => {
  it('builds query keys', () => {
    expect(queryKeys.list(1)).toEqual(expect.arrayContaining(['containers']));
    expect(queryKeys.container(1, 'abc')).toEqual(
      expect.arrayContaining(['abc'])
    );
  });

  it('lists containers through the Docker proxy', async () => {
    server.use(
      http.get('/api/endpoints/1/docker/containers/json', () =>
        HttpResponse.json([
          {
            Id: 'abc',
            Names: ['/web'],
            Image: 'nginx',
            ImageID: 'sha256:1',
            Command: 'nginx',
            Created: 1,
            Ports: [],
            Labels: {},
            State: 'running',
            Status: 'Up',
            HostConfig: {},
            NetworkSettings: { Networks: {} },
            Mounts: [],
          },
        ])
      )
    );
    const list = await getContainers(1);
    expect(list[0].Id).toBe('abc');
    const { result } = wrapHook(() => useContainers(1));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('returns empty list without environment id', async () => {
    expect(await getContainers(undefined as never)).toEqual([]);
  });

  it('inspects updates tops and gpus a local container', async () => {
    server.use(
      http.get('/api/endpoints/1/docker/containers/abc/json', () =>
        HttpResponse.json({ Id: 'abc', Name: '/web' })
      ),
      http.post('/api/endpoints/1/docker/containers/abc/update', () =>
        HttpResponse.json({ Warnings: [] })
      ),
      http.get('/api/endpoints/1/docker/containers/abc/top', () =>
        HttpResponse.json({ Titles: ['PID'], Processes: [['1']] })
      ),
      http.get('/api/docker/1/containers/abc/gpus', () =>
        HttpResponse.json({ gpus: 'all' })
      ),
      http.post('/api/endpoints/1/docker/containers/abc/exec', () =>
        HttpResponse.json({ Id: 'exec-1' })
      ),
      http.post('/api/endpoints/1/docker/containers/abc/resize', () =>
        new HttpResponse(null, { status: 200 })
      )
    );

    expect((await inspectContainer(1, 'abc')).Id).toBe('abc');
    await updateContainer(1, 'abc', { Memory: 1024 });
    expect((await getContainerTop(1, 'abc')).Titles).toEqual(['PID']);
    expect((await createExec(1, 'abc', {
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      DetachKeys: '',
      Tty: true,
      Env: [],
      Cmd: ['sh'],
      Privileged: false,
      User: '',
      WorkingDir: '',
    })).Id).toBe('exec-1');
    await resizeTTY(1, 'abc', { width: 80, height: 24 });

    const inspect = wrapHook(() => useContainerInspect(1, 'abc'));
    await waitFor(() => expect(inspect.result.current.isSuccess).toBe(true));
    const top = wrapHook(() => useContainerTop(1, 'abc'));
    await waitFor(() => expect(top.result.current.isSuccess).toBe(true));
    const gpus = wrapHook(() => useContainerGpus(1, 'abc'));
    await waitFor(() => expect(gpus.result.current.isSuccess).toBe(true));
    expect(gpus.result.current.data).toBe('all');
  });

  it('surfaces inspect errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.get('/api/endpoints/1/docker/containers/abc/json', () =>
        HttpResponse.json({ message: 'gone' }, { status: 404 })
      )
    );
    await expect(inspectContainer(1, 'abc')).rejects.toBeTruthy();
    restore();
  });
});

describe('REQ-CTR-07 useRenameContainer', () => {
  it('renames a local container', async () => {
    server.use(
      http.post('/api/endpoints/1/docker/containers/abc/rename', () =>
        new HttpResponse(null, { status: 204 })
      )
    );
    const { result } = wrapHook(() => useRenameContainer());
    result.current.mutate({
      environmentId: 1,
      containerId: 'abc',
      name: 'renamed',
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('REQ-CTR useContainer', () => {
  it('fetches container details through the Docker proxy', async () => {
    server.use(
      http.get('/api/endpoints/1/docker/containers/abc/json', () =>
        HttpResponse.json({ Id: 'abc', Name: '/web', State: { Status: 'running' } })
      )
    );
    expect((await getContainer(1, 'abc')).Id).toBe('abc');
    const { result } = wrapHook(() =>
      useContainer({ environmentId: 1, containerId: 'abc' }, { enabled: true })
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.Id).toBe('abc');
  });

  it('stays idle without a container id', () => {
    const { result } = wrapHook(() =>
      useContainer({ environmentId: 1 }, { enabled: true })
    );
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('invalidates container query cache', async () => {
    await expect(invalidateContainer(1, 'abc')).resolves.toBeUndefined();
    await expect(invalidateContainer(1)).resolves.toBeUndefined();
  });
});
