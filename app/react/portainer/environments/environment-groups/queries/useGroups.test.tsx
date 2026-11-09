import { renderHook } from '@testing-library/react-hooks';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { useGroups } from './useGroups';

vi.mock('@api/sdk.gen', () => ({
  endpointGroupList: vi.fn(async () => ({
    data: [{ Id: 1, Name: 'dev', Description: '', TagIds: [] }],
  })),
}));

import { endpointGroupList } from '@api/sdk.gen';

function wrapper({ children }: { children: React.ReactNode }) {
  const Wrapped = withTestQueryProvider(() => <>{children}</>);
  return <Wrapped />;
}

describe('REQ-ENV-03 useGroups', () => {
  it('loads environment groups from the API', async () => {
    const { result, waitFor } = renderHook(() => useGroups({ size: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(endpointGroupList).toHaveBeenCalledWith({ query: { size: true } });
    expect(result.current.data).toEqual([
      { Id: 1, Name: 'dev', Description: '', TagIds: [] },
    ]);
  });
});
