import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useDeleteStackMutation } from './useDeleteStackMutation';

describe('REQ-STK-01 useDeleteStackMutation', () => {
  it('deletes a stack by id', async () => {
    let path = '';
    let external: string | null = null;
    server.use(
      http.delete('/api/stacks/:id', ({ request, params }) => {
        path = new URL(request.url).pathname;
        external = new URL(request.url).searchParams.get('external');
        expect(params.id).toBe('4');
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { result } = renderHook(() => useDeleteStackMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await act(async () => {
      await result.current.mutateAsync({
        id: 4,
        external: false,
        environmentId: 1,
      });
    });
    expect(path).toBe('/api/stacks/4');
    expect(external).toBe('false');
  });

  it('surfaces delete errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.delete('/api/stacks/:id', () =>
        HttpResponse.json({ message: 'no' }, { status: 403 })
      )
    );
    const { result } = renderHook(() => useDeleteStackMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await expect(
      result.current.mutateAsync({
        id: 1,
        external: false,
        environmentId: 1,
      })
    ).rejects.toThrow();
    restore();
  });
});
