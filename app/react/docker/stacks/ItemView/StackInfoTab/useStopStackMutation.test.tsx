import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';
import { createMockStack } from '@/react-tools/test-mocks';
import { StackStatus } from '@/react/common/stacks/types';

import { useStopStackMutation } from './useStopStackMutation';

function renderMutationHook() {
  const Wrapper = withTestQueryProvider(({ children }) => <>{children}</>);
  return renderHook(() => useStopStackMutation(), { wrapper: Wrapper });
}

describe('REQ-STK-05 useStopStackMutation', () => {
  it('posts to the stack stop endpoint with the environment id', async () => {
    let requestUrl = '';
    const stack = createMockStack({
      Id: 4,
      Name: 'api',
      Status: StackStatus.Inactive,
    });

    server.use(
      http.post('/api/stacks/:id/stop', ({ request, params }) => {
        requestUrl = request.url;
        expect(params.id).toBe('4');
        return HttpResponse.json(stack);
      })
    );

    const { result } = renderMutationHook();
    result.current.mutate({ id: 4, environmentId: 7 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requestUrl).toContain('/api/stacks/4/stop');
    expect(new URL(requestUrl).searchParams.get('endpointId')).toBe('7');
    expect(result.current.data?.Status).toBe(StackStatus.Inactive);
  });

  it('surfaces a parsed error when stop fails', async () => {
    const restore = suppressConsoleLogs();
    server.use(
      http.post('/api/stacks/:id/stop', () =>
        HttpResponse.json({ message: 'cannot stop' }, { status: 500 })
      )
    );

    const { result } = renderMutationHook();
    result.current.mutate({ id: 1, environmentId: 1 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
    restore();
  });
});
