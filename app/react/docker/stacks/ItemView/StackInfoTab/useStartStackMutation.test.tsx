import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';
import { createMockStack } from '@/react-tools/test-mocks';

import { useStartStackMutation } from './useStartStackMutation';

function renderMutationHook() {
  const Wrapper = withTestQueryProvider(({ children }) => <>{children}</>);
  return renderHook(() => useStartStackMutation(), { wrapper: Wrapper });
}

describe('REQ-STK-05 useStartStackMutation', () => {
  it('posts to the stack start endpoint with the environment id', async () => {
    let requestUrl = '';
    const stack = createMockStack({ Id: 9, Name: 'web' });

    server.use(
      http.post('/api/stacks/:id/start', ({ request, params }) => {
        requestUrl = request.url;
        expect(params.id).toBe('9');
        return HttpResponse.json(stack);
      })
    );

    const { result } = renderMutationHook();
    result.current.mutate({ id: 9, environmentId: 3 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestUrl).toContain('/api/stacks/9/start');
    expect(new URL(requestUrl).searchParams.get('endpointId')).toBe('3');
    expect(result.current.data?.Name).toBe('web');
  });

  it('surfaces a parsed error when start fails', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/stacks/:id/start', () =>
        HttpResponse.json({ message: 'cannot start' }, { status: 500 })
      )
    );

    const { result } = renderMutationHook();
    result.current.mutate({ id: 1, environmentId: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
    restore();
  });
});
