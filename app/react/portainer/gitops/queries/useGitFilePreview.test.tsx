import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useGitFilePreview } from './useGitFilePreview';

describe('REQ-GIT-03 useGitFilePreview', () => {
  it('fetches file content for a stored source', async () => {
    let body: unknown;
    server.use(
      http.post('/api/gitops/repo/file/preview', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ FileContent: 'services:\n  web:\n    image: nginx' });
      })
    );

    const { result } = renderHook(
      () =>
        useGitFilePreview({
          sourceId: 4,
          targetFile: 'docker-compose.yml',
          reference: 'refs/heads/main',
        }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('services:\n  web:\n    image: nginx');
    expect(body).toEqual({
      sourceId: 4,
      targetFile: 'docker-compose.yml',
      reference: 'refs/heads/main',
    });
  });

  it('applies a select transform', async () => {
    server.use(
      http.post('/api/gitops/repo/file/preview', () =>
        HttpResponse.json({ FileContent: 'hello' })
      )
    );

    const { result } = renderHook(
      () =>
        useGitFilePreview(
          { sourceId: 1, targetFile: 'a.yml' },
          { select: (content) => content.toUpperCase() }
        ),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('HELLO');
  });

  it('stays disabled without sourceId or targetFile', async () => {
    let called = false;
    server.use(
      http.post('/api/gitops/repo/file/preview', () => {
        called = true;
        return HttpResponse.json({ FileContent: 'x' });
      })
    );

    const { result } = renderHook(
      () => useGitFilePreview({ targetFile: 'a.yml' }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(result.current.isFetching).toBe(false);
    expect(called).toBe(false);
  });

  it('surfaces preview API errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/gitops/repo/file/preview', () =>
        HttpResponse.json({ message: 'missing' }, { status: 404 })
      )
    );

    const { result } = renderHook(
      () =>
        useGitFilePreview({ sourceId: 9, targetFile: 'missing.yml' }),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(String(result.current.error)).toMatch(/Unable to fetch file from git|missing/i);
    restore();
  });
});
