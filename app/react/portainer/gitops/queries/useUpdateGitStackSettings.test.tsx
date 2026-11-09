import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import {
  updateGitStackSettings,
  useUpdateGitStackSettings,
} from './useUpdateGitStackSettings';

describe('REQ-STK-04 useUpdateGitStackSettings', () => {
  it('saves git stack settings and invalidates the stack query', async () => {
    let path = '';
    let endpointId: string | null = null;
    let body: unknown;
    server.use(
      http.post('/api/stacks/:id/git', async ({ request, params }) => {
        path = new URL(request.url).pathname;
        endpointId = new URL(request.url).searchParams.get('endpointId');
        body = await request.json();
        expect(params.id).toBe('8');
        return HttpResponse.json({ Id: 8 });
      })
    );

    const { result } = renderHook(() => useUpdateGitStackSettings(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await act(async () => {
      const data = await result.current.mutateAsync({
        stackId: 8,
        endpointId: 2,
        payload: {
          env: [{ name: 'FOO', value: 'bar' }],
          prune: false,
          RepositoryURL: 'https://example.com/repo.git',
          ConfigFilePath: 'docker-compose.yml',
          RepositoryReferenceName: 'refs/heads/main',
          TLSSkipVerify: true,
          SourceID: 4,
        },
      });
      expect(data).toEqual({ Id: 8 });
    });

    expect(path).toBe('/api/stacks/8/git');
    expect(endpointId).toBe('2');
    expect(body).toMatchObject({
      RepositoryURL: 'https://example.com/repo.git',
      SourceID: 4,
      TLSSkipVerify: true,
    });
  });

  it('updateGitStackSettings surfaces axios errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/stacks/:id/git', () =>
        HttpResponse.json({ message: 'bad' }, { status: 400 })
      )
    );

    await expect(
      updateGitStackSettings(1, 1, {
        env: [],
        RepositoryURL: 'https://example.com/r.git',
      })
    ).rejects.toThrow();
    restore();
  });
});
