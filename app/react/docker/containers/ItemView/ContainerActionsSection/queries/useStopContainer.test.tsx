import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, Fragment } from 'react';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useStopContainer } from './useStopContainer';

function renderMutationHook() {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(() => useStopContainer(), { wrapper: Wrapper });
}

describe('REQ-CTR-02 useStopContainer', () => {
  it('stops a local container through the Docker proxy', async () => {
    let requestUrl = '';
    server.use(
      http.post(
        '/api/endpoints/:envId/docker/containers/:id/stop',
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
      '/api/endpoints/1/docker/containers/abc/stop'
    );
  });

  it('sends X-PortainerAgent-Target when nodeName is set', async () => {
    let target: string | null = null;
    server.use(
      http.post(
        '/api/endpoints/:envId/docker/containers/:id/stop',
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

  it('surfaces an error when stop fails', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post(
        '/api/endpoints/:envId/docker/containers/:id/stop',
        () =>
          HttpResponse.json({ message: 'Failed stopping container' }, { status: 500 })
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
