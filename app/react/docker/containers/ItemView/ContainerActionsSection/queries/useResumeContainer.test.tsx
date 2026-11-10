import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, Fragment } from 'react';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useResumeContainer } from './useResumeContainer';

function renderMutationHook() {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(() => useResumeContainer(), { wrapper: Wrapper });
}

describe('REQ-CTR-02 useResumeContainer', () => {
  it('resumes a local container through the Docker proxy', async () => {
    let requestUrl = '';
    server.use(
      http.post(
        '/api/endpoints/:envId/docker/containers/:id/unpause',
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
      '/api/endpoints/1/docker/containers/abc/unpause'
    );
  });

  it('REQ-TAI-007 sends no X-PortainerAgent-Target even if a nodeName is passed', async () => {
    let target: string | null = null;
    server.use(
      http.post(
        '/api/endpoints/:envId/docker/containers/:id/unpause',
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
    expect(target).toBeNull();
  });

  it('surfaces an error when resume fails', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post(
        '/api/endpoints/:envId/docker/containers/:id/unpause',
        () =>
          HttpResponse.json({ message: 'Failed resuming container' }, { status: 500 })
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
