import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, Fragment } from 'react';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useRecreateContainer } from './useRecreateContainer';

function renderMutationHook() {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(() => useRecreateContainer(), { wrapper: Wrapper });
}

describe('REQ-CTR-06 useRecreateContainer', () => {
  it('posts recreate with PullImage through the Docker API', async () => {
    let requestUrl = '';
    let body: { PullImage?: boolean } | undefined;
    server.use(
      http.post(
        '/api/docker/:envId/containers/:id/recreate',
        async ({ request, params }) => {
          requestUrl = request.url;
          body = (await request.json()) as { PullImage?: boolean };
          expect(params.envId).toBe('1');
          expect(params.id).toBe('abc');
          return new HttpResponse(null, { status: 204 });
        }
      )
    );

    const { result } = renderMutationHook();
    result.current.mutate({
      environmentId: 1,
      containerId: 'abc',
      pullImage: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestUrl).toContain('/api/docker/1/containers/abc/recreate');
    expect(body?.PullImage).toBe(true);
  });

  it('REQ-TAI-007 sends no X-PortainerAgent-Target even if a nodeName is passed', async () => {
    let target: string | null = null;
    server.use(
      http.post('/api/docker/:envId/containers/:id/recreate', ({ request }) => {
        target = request.headers.get('X-PortainerAgent-Target');
        return new HttpResponse(null, { status: 204 });
      })
    );

    const { result } = renderMutationHook();
    result.current.mutate({
      environmentId: 1,
      containerId: 'abc',
      pullImage: false,
      nodeName: 'node-b',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(target).toBeNull();
  });

  it('surfaces an error when recreate fails', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/docker/:envId/containers/:id/recreate', () =>
        HttpResponse.json({ message: 'Failed recreating container' }, { status: 500 })
      )
    );

    const { result } = renderMutationHook();
    result.current.mutate({
      environmentId: 1,
      containerId: 'abc',
      pullImage: false,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
    restore();
  });
});
