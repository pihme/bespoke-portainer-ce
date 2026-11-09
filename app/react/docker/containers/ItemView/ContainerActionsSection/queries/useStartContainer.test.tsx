import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, Fragment } from 'react';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useStartContainer } from './useStartContainer';

function renderMutationHook() {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(() => useStartContainer(), { wrapper: Wrapper });
}

describe('REQ-CTR-02 useStartContainer', () => {
  it('starts a local container through the Docker proxy', async () => {
    let requestUrl = '';
    server.use(
      http.post(
        '/api/endpoints/:envId/docker/containers/:id/start',
        ({ request, params }) => {
          requestUrl = request.url;
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
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestUrl).toContain(
      '/api/endpoints/1/docker/containers/abc/start'
    );
  });

  it('sends X-PortainerAgent-Target when nodeName is set', async () => {
    let target: string | null = null;
    server.use(
      http.post(
        '/api/endpoints/:envId/docker/containers/:id/start',
        ({ request }) => {
          target = request.headers.get('X-PortainerAgent-Target');
          return new HttpResponse(null, { status: 204 });
        }
      )
    );

    const { result } = renderMutationHook();
    result.current.mutate({
      environmentId: 1,
      containerId: 'abc',
      nodeName: 'node-a',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(target).toBe('node-a');
  });

  it('surfaces an error when start fails', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post(
        '/api/endpoints/:envId/docker/containers/:id/start',
        () =>
          HttpResponse.json({ message: 'Failed starting container' }, { status: 500 })
      )
    );

    const { result } = renderMutationHook();
    result.current.mutate({
      environmentId: 1,
      containerId: 'abc',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
    restore();
  });
});
