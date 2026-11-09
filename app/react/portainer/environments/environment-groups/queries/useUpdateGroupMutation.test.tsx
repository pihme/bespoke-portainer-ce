import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { notifySuccess } from '@/portainer/services/notifications';

import { updateGroup, useUpdateGroupMutation } from './useUpdateGroupMutation';

vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const Wrapped = withTestQueryProvider(() => <>{children}</>);
  return <Wrapped />;
}

describe('REQ-ENV-03 useUpdateGroupMutation', () => {
  it('puts group updates and notifies success', async () => {
    let body: unknown;
    server.use(
      http.put('/api/endpoint_groups/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ Id: 3, Name: 'renamed' });
      })
    );
    await expect(
      updateGroup({
        id: 3,
        name: 'renamed',
        description: 'x',
        tagIds: [1],
        associatedEnvironments: [8],
      })
    ).resolves.toMatchObject({ Id: 3, Name: 'renamed' });
    expect(body).toMatchObject({
      Name: 'renamed',
      Description: 'x',
      TagIDs: [1],
      AssociatedEndpoints: [8],
    });

    const { result, waitFor } = renderHook(() => useUpdateGroupMutation(), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({ id: 3, name: 'renamed' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalled();
  });

  it('surfaces update failures', async () => {
    server.use(
      http.put('/api/endpoint_groups/:id', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );
    await expect(updateGroup({ id: 1, name: 'x' })).rejects.toThrow(
      /update group/i
    );
  });
});
