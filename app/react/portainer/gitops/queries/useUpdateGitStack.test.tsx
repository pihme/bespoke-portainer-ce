import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { updateGitStack, useUpdateGitStack } from './useUpdateGitStack';

describe('REQ-STK-04 useUpdateGitStack', () => {
  it('redeploys a git stack and invalidates the stack query', async () => {
    let path = '';
    let endpointId: string | null = null;
    let body: unknown;
    server.use(
      http.put('/api/stacks/:id/git/redeploy', async ({ request, params }) => {
        path = new URL(request.url).pathname;
        endpointId = new URL(request.url).searchParams.get('endpointId');
        body = await request.json();
        expect(params.id).toBe('12');
        return HttpResponse.json({ Id: 12 });
      })
    );

    const { result } = renderHook(() => useUpdateGitStack(12, 1), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    await act(async () => {
      const data = await result.current.mutateAsync({
        RepositoryReferenceName: 'refs/heads/main',
        Prune: true,
        RepullImageAndRedeploy: true,
        Env: [{ name: 'A', value: '1' }],
      });
      expect(data).toEqual({ Id: 12 });
    });

    expect(path).toBe('/api/stacks/12/git/redeploy');
    expect(endpointId).toBe('1');
    expect(body).toMatchObject({
      RepositoryReferenceName: 'refs/heads/main',
      Prune: true,
      RepullImageAndRedeploy: true,
    });
  });

  it('updateGitStack surfaces axios errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.put('/api/stacks/:id/git/redeploy', () =>
        HttpResponse.json({ message: 'denied' }, { status: 403 })
      )
    );

    await expect(
      updateGitStack(3, 1, { StackName: 'web' })
    ).rejects.toThrow();
    restore();
  });
});
