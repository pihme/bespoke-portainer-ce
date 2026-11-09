import { renderHook, act } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';

import { createGroup, useCreateGroupMutation } from './useCreateGroupMutation';

function wrapper({ children }: { children: React.ReactNode }) {
  const Wrapped = withTestQueryProvider(() => <>{children}</>);
  return <Wrapped />;
}

describe('REQ-ENV-03 useCreateGroupMutation', () => {
  it('posts a new group payload', async () => {
    let body: unknown;
    server.use(
      http.post('/api/endpoint_groups', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ Id: 9, Name: 'new' });
      })
    );
    const group = await createGroup({
      name: 'new',
      description: 'd',
      associatedEnvironments: [1],
      tagIds: [2],
    });
    expect(group).toMatchObject({ Id: 9, Name: 'new' });
    expect(body).toMatchObject({
      Name: 'new',
      Description: 'd',
      AssociatedEndpoints: [1],
      TagIDs: [2],
    });

    const { result, waitFor } = renderHook(() => useCreateGroupMutation(), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({ name: 'new' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('surfaces create failures', async () => {
    server.use(
      http.post('/api/endpoint_groups', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );
    await expect(createGroup({ name: 'x' })).rejects.toThrow(/create group/i);
  });
});
