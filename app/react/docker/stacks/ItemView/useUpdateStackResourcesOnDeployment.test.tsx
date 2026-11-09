import { renderHook } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

import { createMockStack } from '@/react-tools/test-mocks';
import { StackStatus } from '@/react/common/stacks/types';
import { queryKeys as dockerQueryKeys } from '@/react/docker/queries/utils';

import { useUpdateStackResourcesOnDeployment } from './useUpdateStackResourcesOnDeployment';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('REQ-STK-04 useUpdateStackResourcesOnDeployment', () => {
  it('invalidates docker root queries when status leaves Deploying', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const deploying = createMockStack({
      Id: 11,
      EndpointId: 5,
      Status: StackStatus.Deploying,
    });

    const { rerender } = renderHook(
      ({ stack }) => useUpdateStackResourcesOnDeployment(stack),
      {
        wrapper: createWrapper(queryClient),
        initialProps: { stack: deploying as typeof deploying | undefined },
      }
    );

    expect(invalidateSpy).not.toHaveBeenCalled();

    rerender({
      stack: { ...deploying, Status: StackStatus.Active },
    });

    expect(invalidateSpy).toHaveBeenCalledWith(dockerQueryKeys.root(5));
  });

  it('does nothing when the stack id is missing', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useUpdateStackResourcesOnDeployment(undefined), {
      wrapper: createWrapper(queryClient),
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('does not invalidate when status stays Deploying', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const deploying = createMockStack({
      Id: 2,
      EndpointId: 1,
      Status: StackStatus.Deploying,
    });

    const { rerender } = renderHook(
      ({ stack }) => useUpdateStackResourcesOnDeployment(stack),
      {
        wrapper: createWrapper(queryClient),
        initialProps: { stack: deploying },
      }
    );

    rerender({ stack: { ...deploying, Name: 'still-deploying' } });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
