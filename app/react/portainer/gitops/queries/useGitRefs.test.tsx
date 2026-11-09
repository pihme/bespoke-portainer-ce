import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { listRefs, useGitRefs } from './useGitRefs';

vi.mock('@/react/portainer/feature-flags/feature-flags.service', () => ({
  isBE: true,
}));

describe('REQ-GIT-02 useGitRefs', () => {
  it('lists refs for a source', async () => {
    let body: unknown;
    let force: string | null = null;
    server.use(
      http.post('/api/gitops/repo/refs', async ({ request }) => {
        body = await request.json();
        force = new URL(request.url).searchParams.get('force');
        return HttpResponse.json(['refs/heads/main', 'refs/tags/v1']);
      })
    );

    const { result } = renderHook(
      () => useGitRefs({ sourceId: 3, force: true }, { enabled: true }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(['refs/heads/main', 'refs/tags/v1']);
    expect(body).toEqual({ sourceId: 3 });
    expect(force).toBe('true');
  });

  it('applies select and onSuccess callbacks', async () => {
    server.use(
      http.post('/api/gitops/repo/refs', () =>
        HttpResponse.json(['refs/heads/dev'])
      )
    );
    const onSuccess = vi.fn();
    const onSettled = vi.fn();

    const { result } = renderHook(
      () =>
        useGitRefs(
          { sourceId: 1 },
          {
            enabled: true,
            select: (refs) => refs.map((r) => r.toUpperCase()),
            onSuccess,
            onSettled,
          }
        ),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(['REFS/HEADS/DEV']);
    expect(onSuccess).toHaveBeenCalledWith(['REFS/HEADS/DEV']);
    expect(onSettled).toHaveBeenCalled();
  });

  it('listRefs posts the payload directly', async () => {
    server.use(
      http.post('/api/gitops/repo/refs', () =>
        HttpResponse.json(['refs/heads/main'])
      )
    );
    await expect(listRefs({ sourceId: 2 })).resolves.toEqual([
      'refs/heads/main',
    ]);
  });

  it('surfaces errors unless suppressError is set', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/gitops/repo/refs', () =>
        HttpResponse.json({ message: 'fail' }, { status: 500 })
      )
    );

    const { result } = renderHook(
      () =>
        useGitRefs(
          { sourceId: 1 },
          { enabled: true, suppressError: true }
        ),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    restore();
  });
});
