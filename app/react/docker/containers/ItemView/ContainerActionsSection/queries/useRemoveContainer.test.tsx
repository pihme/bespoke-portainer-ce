import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, Fragment } from 'react';
import { vi } from 'vitest';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useRemoveContainer } from './useRemoveContainer';

const mockGo = vi.fn();

vi.mock('@uirouter/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uirouter/react')>();
  return {
    ...actual,
    useRouter: () => ({ stateService: { go: mockGo } }),
  };
});

function renderMutationHook() {
  const Wrapper = withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
  return renderHook(() => useRemoveContainer(), { wrapper: Wrapper });
}

describe('REQ-CTR-14 useRemoveContainer', () => {
  beforeEach(() => {
    mockGo.mockClear();
  });

  it('deletes a local container and navigates back on success', async () => {
    let requestUrl = '';
    let force: string | null = null;
    let volumes: string | null = null;
    server.use(
      http.delete(
        '/api/endpoints/:envId/docker/containers/:id',
        ({ request, params }) => {
          requestUrl = request.url;
          const url = new URL(request.url);
          force = url.searchParams.get('force');
          volumes = url.searchParams.get('v');
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
      removeVolumes: true,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestUrl).toContain('/api/endpoints/1/docker/containers/abc');
    expect(force).toBe('true');
    expect(volumes).toBe('1');
    expect(mockGo).toHaveBeenCalledWith('^');
  });

  it('omits volume removal when removeVolumes is false', async () => {
    let volumes: string | null = null;
    server.use(
      http.delete(
        '/api/endpoints/:envId/docker/containers/:id',
        ({ request }) => {
          volumes = new URL(request.url).searchParams.get('v');
          return new HttpResponse(null, { status: 204 });
        }
      )
    );

    const { result } = renderMutationHook();
    result.current.mutate({
      environmentId: 1,
      containerId: 'abc',
      removeVolumes: false,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(volumes).toBe('0');
  });

  it('REQ-TAI-007 sends no X-PortainerAgent-Target even if a nodeName is passed', async () => {
    let target: string | null = null;
    server.use(
      http.delete(
        '/api/endpoints/:envId/docker/containers/:id',
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
      nodeName: 'node-c',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(target).toBeNull();
  });

  it('surfaces an error when remove fails', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.delete('/api/endpoints/:envId/docker/containers/:id', () =>
        HttpResponse.json({ message: 'Unable to remove container' }, { status: 500 })
      )
    );

    const { result } = renderMutationHook();
    result.current.mutate({
      environmentId: 1,
      containerId: 'abc',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
    expect(mockGo).not.toHaveBeenCalled();
    restore();
  });
});
