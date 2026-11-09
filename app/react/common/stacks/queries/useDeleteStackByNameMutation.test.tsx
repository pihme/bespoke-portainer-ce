import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useDeleteStackByNameMutation } from './useDeleteStackByNameMutation';

describe('REQ-STK-01 useDeleteStackByNameMutation', () => {
  it('deletes a stack by name and namespace', async () => {
    let path = '';
    let namespace: string | null = null;
    server.use(
      http.delete('/api/stacks/name/:name', ({ request, params }) => {
        path = new URL(request.url).pathname;
        namespace = new URL(request.url).searchParams.get('namespace');
        expect(params.name).toBe('web');
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { result } = renderHook(() => useDeleteStackByNameMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await act(async () => {
      await result.current.mutateAsync({
        stackId: 8,
        stackName: 'web',
        environmentId: 1,
        namespace: 'default',
      });
    });
    expect(path).toBe('/api/stacks/name/web');
    expect(namespace).toBe('default');
  });

  it('surfaces delete-by-name errors', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.delete('/api/stacks/name/:name', () =>
        HttpResponse.json({ message: 'no' }, { status: 500 })
      )
    );
    const { result } = renderHook(() => useDeleteStackByNameMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await expect(
      result.current.mutateAsync({
        stackId: 1,
        stackName: 'web',
        environmentId: 1,
        namespace: 'default',
      })
    ).rejects.toThrow();
    restore();
  });
});
