import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

import { useDeleteEnvironmentsMutation } from './useDeleteEnvironmentsMutation';

const notifyError = vi.fn();
const notifySuccess = vi.fn();

vi.mock('@/portainer/services/notifications', () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const Wrapped = withTestQueryProvider(() => <>{children}</>);
  return <Wrapped />;
}

describe('REQ-ENV-03 useDeleteEnvironmentsMutation', () => {
  beforeEach(() => {
    notifyError.mockReset();
    notifySuccess.mockReset();
  });

  it('treats a null response as deleting every requested environment', async () => {
    server.use(
      http.post('/api/endpoints/delete', () => HttpResponse.json(null))
    );
    const { result, waitFor } = renderHook(
      () => useDeleteEnvironmentsMutation(),
      { wrapper }
    );

    act(() => {
      result.current.mutate([
        { id: 1, name: 'local', deleteCluster: false },
        { id: 2, name: 'other', deleteCluster: false },
      ]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('splits deleted and errored environment ids from the response', async () => {
    server.use(
      http.post('/api/endpoints/delete', () =>
        HttpResponse.json({ deleted: [1], errors: [2] })
      )
    );
    const { result, waitFor } = renderHook(
      () => useDeleteEnvironmentsMutation(),
      { wrapper }
    );

    act(() => {
      result.current.mutate([
        { id: 1, name: 'local' },
        { id: 2, name: 'broken' },
      ]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      'Failed to remove environment broken',
      undefined
    );
    expect(notifySuccess).toHaveBeenCalledWith(
      'Environment successfully removed',
      'local'
    );
  });
});
