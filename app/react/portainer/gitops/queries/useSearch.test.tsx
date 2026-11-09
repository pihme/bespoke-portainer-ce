import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

import { searchRepo, useSearch } from './useSearch';

vi.mock('../../feature-flags/feature-flags.service', () => ({
  isBE: true,
}));

describe('REQ-GIT-02 useSearch', () => {
  it('searches repository files for a source', async () => {
    let body: unknown;
    server.use(
      http.post('/api/gitops/repo/files/search', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(['compose.yml', 'override.yml']);
      })
    );

    const { result } = renderHook(
      () =>
        useSearch(
          {
            keyword: 'compose',
            sourceId: 5,
            reference: 'main',
            dirOnly: false,
          },
          true
        ),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(['compose.yml', 'override.yml']);
    expect(body).toEqual({
      keyword: 'compose',
      sourceId: 5,
      reference: 'main',
      dirOnly: false,
    });
  });

  it('searchRepo returns null payloads', async () => {
    server.use(
      http.post('/api/gitops/repo/files/search', () =>
        HttpResponse.json(null)
      )
    );
    await expect(
      searchRepo({ keyword: 'x', sourceId: 1 })
    ).resolves.toBeNull();
  });

  it('stays disabled when enabled is false', async () => {
    let called = false;
    server.use(
      http.post('/api/gitops/repo/files/search', () => {
        called = true;
        return HttpResponse.json([]);
      })
    );

    const { result } = renderHook(
      () => useSearch({ keyword: 'x', sourceId: 1 }, false),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(called).toBe(false);
  });
});
