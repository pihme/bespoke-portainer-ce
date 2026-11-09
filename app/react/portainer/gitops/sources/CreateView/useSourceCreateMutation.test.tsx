import { renderHook, act } from '@testing-library/react-hooks';
import { vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { useCreateSourceMutation } from './useSourceCreateMutation';

const createGit = vi.fn(async () => ({ data: { Id: 1 } }));

vi.mock('@api/sdk.gen', () => ({
  gitOpsSourcesCreateGit: (...args: unknown[]) => createGit(...args),
}));

describe('REQ-GIT-02 useCreateSourceMutation', () => {
  it('creates a git source', async () => {
    const { result } = renderHook(() => useCreateSourceMutation(), {
      wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
    });
    await act(async () => {
      const data = await result.current.mutateAsync({
        type: 'git',
        git: { Name: 'src', URL: 'https://example.com/r.git' } as never,
      });
      expect(data).toEqual({ Id: 1 });
    });
    expect(createGit).toHaveBeenCalled();
  });
});
