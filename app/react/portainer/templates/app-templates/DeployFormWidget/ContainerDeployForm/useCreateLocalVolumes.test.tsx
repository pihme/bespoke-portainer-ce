import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { useCreateLocalVolumes } from './useCreateLocalVolumes';

const createVolume = vi.fn();

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 7,
}));

vi.mock('@/react/docker/volumes/queries/useCreateVolume', () => ({
  createVolume: (...args: unknown[]) => createVolume(...args),
}));

describe('REQ-TPL-01 useCreateLocalVolumes', () => {
  beforeEach(() => {
    createVolume.mockReset();
    createVolume.mockImplementation(async (_envId: number, _body: unknown) => ({
      Name: `vol-${createVolume.mock.calls.length}`,
    }));
  });

  it('creates the requested number of local volumes', async () => {
    const { result } = renderHook(() => useCreateLocalVolumes(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    result.current.mutate(2);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createVolume).toHaveBeenCalledTimes(2);
    expect(createVolume).toHaveBeenCalledWith(7, { Driver: 'local' });
    expect(result.current.data).toEqual([
      { Name: 'vol-1' },
      { Name: 'vol-2' },
    ]);
  });

  it('creates no volumes when the count is zero', async () => {
    const { result } = renderHook(() => useCreateLocalVolumes(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });

    result.current.mutate(0);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createVolume).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });
});
