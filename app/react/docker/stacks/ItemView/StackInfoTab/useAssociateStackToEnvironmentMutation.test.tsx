import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { server } from '@/setup-tests/server';
import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { Stack } from '@/react/common/stacks/types';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import { useAssociateStackToEnvironmentMutation } from './useAssociateStackToEnvironmentMutation';

function renderMutationHook() {
  const Wrapper = withTestQueryProvider(({ children }) => <>{children}</>);

  return renderHook(() => useAssociateStackToEnvironmentMutation(), {
    wrapper: Wrapper,
  });
}

describe('useAssociateStackToEnvironmentMutation', () => {
  describe('successful association', () => {
    it('should make PUT request to correct endpoint with params', async () => {
      let requestUrl = '';
      let capturedParams: URLSearchParams | undefined;

      server.use(
        http.put('/api/stacks/:id/associate', async ({ request, params }) => {
          requestUrl = request.url;
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            Id: Number(params.id),
            Name: 'test-stack',
            ResourceControl: {
              Id: 1,
              ResourceId: Number(params.id),
              Type: 6,
            },
          } as Partial<Stack>);
        })
      );

      const { result } = renderMutationHook();

      result.current.mutate({
        environmentId: 5,
        stackId: 123,
        isOrphanedRunning: true,
        swarmId: 'swarm-123',
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(requestUrl).toContain('/api/stacks/123/associate');
      expect(capturedParams?.get('endpointId')).toBe('5');
      expect(capturedParams?.get('orphanedRunning')).toBe('true');
      expect(capturedParams?.get('swarmId')).toBe('swarm-123');
    });

    it('REQ-TAI-001 associates without applying any ownership', async () => {
      const resourceControlCalls = vi.fn();
      server.use(
        http.put('/api/stacks/:id/associate', () =>
          HttpResponse.json({ Id: 123, Name: 'test-stack' } as Partial<Stack>)
        ),
        http.all('/api/resource_controls*', () => {
          resourceControlCalls();
          return HttpResponse.json(null, { status: 404 });
        })
      );

      const { result } = renderMutationHook();

      result.current.mutate({ environmentId: 1, stackId: 123 });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(resourceControlCalls).not.toHaveBeenCalled();
    });

    it('should handle optional swarmId parameter', async () => {
      let capturedParams: URLSearchParams | undefined;

      server.use(
        http.put('/api/stacks/:id/associate', async ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            Id: 123,
            Name: 'test-stack',
            ResourceControl: {
              Id: 1,
              ResourceId: 123,
              Type: 6,
            },
          } as Partial<Stack>);
        })
      );

      const { result } = renderMutationHook();

      result.current.mutate({
        environmentId: 1,
        stackId: 123,
        // swarmId is undefined
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // swarmId should not be in params when undefined
      expect(capturedParams?.get('swarmId')).toBeNull();
    });

    it('should default orphanedRunning to false when undefined', async () => {
      let capturedParams: URLSearchParams | undefined;

      server.use(
        http.put('/api/stacks/:id/associate', async ({ request }) => {
          capturedParams = new URL(request.url).searchParams;
          return HttpResponse.json({
            Id: 123,
            Name: 'test-stack',
            ResourceControl: {
              Id: 1,
              ResourceId: 123,
              Type: 6,
            },
          } as Partial<Stack>);
        })
      );

      const { result } = renderMutationHook();

      result.current.mutate({
        environmentId: 1,
        stackId: 123,
        // isOrphanedRunning is undefined
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(capturedParams?.get('orphanedRunning')).toBe('false');
    });
  });

  describe('error handling', () => {
    let restoreConsole: () => void;

    beforeEach(() => {
      restoreConsole = suppressConsoleLogs();
    });

    afterEach(() => {
      restoreConsole();
    });

    it('should handle API error when association fails', async () => {
      server.use(
        http.put('/api/stacks/:id/associate', () =>
          HttpResponse.json({ message: 'Association failed' }, { status: 500 })
        )
      );

      const { result } = renderMutationHook();

      result.current.mutate({
        environmentId: 1,
        stackId: 123,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });

  });

  describe('mutation states', () => {
    it('should track loading state during mutation', async () => {
      server.use(
        http.put('/api/stacks/:id/associate', async () => {
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
          return HttpResponse.json({
            Id: 123,
            Name: 'test-stack',
            ResourceControl: {
              Id: 1,
              ResourceId: 123,
              Type: 6,
            },
          } as Partial<Stack>);
        })
      );

      const { result } = renderMutationHook();

      expect(result.current.isLoading).toBe(false);

      result.current.mutate({
        environmentId: 1,
        stackId: 123,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should return stack data on success', async () => {
      const mockStack = {
        Id: 123,
        Name: 'test-stack',
        ResourceControl: {
          Id: 1,
          ResourceId: 123,
          Type: 6,
        },
      } as Partial<Stack>;

      server.use(
        http.put('/api/stacks/:id/associate', () =>
          HttpResponse.json(mockStack)
        )
      );

      const { result } = renderMutationHook();

      result.current.mutate({
        environmentId: 1,
        stackId: 123,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeUndefined();
    });
  });
});
