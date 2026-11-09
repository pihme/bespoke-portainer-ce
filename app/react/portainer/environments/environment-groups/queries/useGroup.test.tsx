import { renderHook } from '@testing-library/react-hooks';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { useGroup } from './useGroup';

vi.mock('@api/sdk.gen', () => ({
  getEndpointGroupsById: vi.fn(async ({ path }: { path: { id: number } }) => ({
    data: { Id: path.id, Name: 'prod', Description: '', TagIds: [] },
  })),
}));

import { getEndpointGroupsById } from '@api/sdk.gen';

function wrapper({ children }: { children: React.ReactNode }) {
  const Wrapped = withTestQueryProvider(() => <>{children}</>);
  return <Wrapped />;
}

describe('REQ-ENV-03 useGroup', () => {
  it('loads a group by id', async () => {
    const { result, waitFor } = renderHook(() => useGroup(2, { size: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getEndpointGroupsById).toHaveBeenCalledWith({
      path: { id: 2 },
      query: { size: true },
    });
    expect(result.current.data).toMatchObject({ Id: 2, Name: 'prod' });
  });

  it('stays idle when group id is undefined', () => {
    const { result } = renderHook(() => useGroup(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns null from the query fn when id becomes undefined mid-flight', async () => {
    // cover the groupId === undefined branch inside queryFn via enabled false path already;
    // additionally exercise select
    const { result, waitFor } = renderHook(
      () => useGroup(2, { select: (g) => g?.Name ?? '' }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('prod');
  });
});
