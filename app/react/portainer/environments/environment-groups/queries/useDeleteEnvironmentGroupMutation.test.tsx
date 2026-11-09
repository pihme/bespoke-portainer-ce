import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useDeleteEnvironmentGroupMutation } from './useDeleteEnvironmentGroupMutation';

function wrapper({ children }: { children: React.ReactNode }) {
  const Wrapped = withTestQueryProvider(() => <>{children}</>);
  return <Wrapped />;
}

describe('REQ-ENV-03 useDeleteEnvironmentGroupMutation', () => {
  it('deletes a group by id', async () => {
    let deletedId = '';
    server.use(
      http.delete('/api/endpoint_groups/:id', ({ params }) => {
        deletedId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { result, waitFor } = renderHook(
      () => useDeleteEnvironmentGroupMutation(),
      { wrapper }
    );
    await act(async () => {
      await result.current.mutateAsync(4);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deletedId).toBe('4');
  });

  it('surfaces delete failures', async () => {
    suppressConsoleLogs();
    server.use(
      http.delete('/api/endpoint_groups/:id', () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 })
      )
    );
    const { result } = renderHook(() => useDeleteEnvironmentGroupMutation(), {
      wrapper,
    });
    await expect(result.current.mutateAsync(4)).rejects.toThrow(
      /delete environment group/i
    );
  });
});
