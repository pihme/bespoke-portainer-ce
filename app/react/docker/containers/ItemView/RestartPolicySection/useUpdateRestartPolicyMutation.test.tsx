import { renderHook, act } from '@testing-library/react-hooks';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { RestartPolicy } from '../../CreateView/RestartPolicyTab/types';

const updateContainer = vi.fn();
const invalidateQueries = vi.fn();

vi.mock('../../queries/useUpdateContainer', () => ({
  updateContainer: (...args: unknown[]) => updateContainer(...args),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries }),
  };
});

import { useUpdateRestartPolicyMutation } from './useUpdateRestartPolicyMutation';

describe('useUpdateRestartPolicyMutation', () => {
  beforeEach(() => {
    updateContainer.mockReset().mockResolvedValue(undefined);
    invalidateQueries.mockReset();
  });

  it('updates restart policy and invalidates the container query', async () => {
    const { result, waitFor } = renderHook(
      () => useUpdateRestartPolicyMutation(),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await act(async () => {
      result.current.mutate({
        environmentId: 1,
        containerId: 'c1',
        policy: { name: RestartPolicy.Always },
        nodeName: 'n1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateContainer).toHaveBeenCalledWith(
      1,
      'c1',
      {
        RestartPolicy: {
          Name: RestartPolicy.Always,
          MaximumRetryCount: undefined,
        },
      },
      { nodeName: 'n1' }
    );
    expect(invalidateQueries).toHaveBeenCalled();
  });

  it('passes maximumRetryCount for on-failure policy', async () => {
    const { result, waitFor } = renderHook(
      () => useUpdateRestartPolicyMutation(),
      {
        wrapper: withTestQueryProvider(({ children }) => <>{children}</>),
      }
    );

    await act(async () => {
      result.current.mutate({
        environmentId: 2,
        containerId: 'c2',
        policy: { name: RestartPolicy.OnFailure, maximumRetryCount: 5 },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateContainer).toHaveBeenCalledWith(
      2,
      'c2',
      {
        RestartPolicy: {
          Name: RestartPolicy.OnFailure,
          MaximumRetryCount: 5,
        },
      },
      { nodeName: undefined }
    );
  });
});
