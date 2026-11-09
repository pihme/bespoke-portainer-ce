import { waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { http, HttpResponse } from 'msw';
import { createElement, Fragment } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';
import { server } from '@/setup-tests/server';
import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

const { deleteNetwork } = vi.hoisted(() => ({
  deleteNetwork: vi.fn(),
}));

vi.mock('./useDeleteNetworkMutation', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./useDeleteNetworkMutation')>();
  return {
    ...actual,
    deleteNetwork,
  };
});

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

const notifySuccess = vi.fn();
const notifyError = vi.fn();
vi.mock('@/portainer/services/notifications', () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
  notifyError: (...args: unknown[]) => notifyError(...args),
}));

vi.mock('@/react/common/processItemsInBatches', () => ({
  processItemsInBatches: async (
    items: Array<{ id: string; name: string; nodeName?: string }>,
    fn: (item: { id: string; name: string; nodeName?: string }) => Promise<void>
  ) => {
    for (const item of items) {
      // eslint-disable-next-line no-await-in-loop
      await fn(item);
    }
  },
}));

import { useNetworks } from './useNetworks';
import { useNetwork } from './useNetwork';
import { useDeleteNetwork } from './useDeleteNetworkMutation';
import { useDeleteNetworkListMutation } from './useDeleteNetworkListMutation';
import { useConnectContainerMutation } from './useConnectContainerMutation';
import { useDisconnectContainer } from './useDisconnectContainerMutation';

function wrap() {
  return withTestQueryProvider(({ children }) =>
    createElement(Fragment, null, children)
  );
}

describe('networks query hooks', () => {
  beforeEach(() => {
    deleteNetwork.mockReset();
    notifySuccess.mockReset();
    notifyError.mockReset();
  });

  it('loads the network list for a local query', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/networks', () =>
        HttpResponse.json([
          {
            Name: 'bridge',
            Id: '1',
            Driver: 'bridge',
            Scope: 'local',
            Attachable: false,
            Internal: false,
          },
        ])
      )
    );
    const { result } = renderHook(() => useNetworks(1, { local: true }), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].Name).toBe('bridge');
  });

  it('loads a single network', async () => {
    server.use(
      http.get('/api/endpoints/:id/docker/networks/:networkId', () =>
        HttpResponse.json({ Id: 'n1', Name: 'bridge' })
      )
    );
    const { result } = renderHook(() => useNetwork(1, 'n1'), {
      wrapper: wrap(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.Name).toBe('bridge');
  });

  it('deletes a network through useDeleteNetwork', async () => {
    server.use(
      http.delete('/api/endpoints/:id/docker/networks/:networkId', () =>
        HttpResponse.json(null, { status: 204 })
      )
    );
    const { result } = renderHook(() => useDeleteNetwork(1), {
      wrapper: wrap(),
    });
    result.current.mutate({ networkId: 'n1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('deletes a network list with success and error notifications', async () => {
    const restore = suppressConsoleLogs();
    deleteNetwork
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(new Error('busy'));
    const { result } = renderHook(() => useDeleteNetworkListMutation(), {
      wrapper: wrap(),
    });
    result.current.mutate({
      networks: [
        { id: 'a', name: 'alpha' },
        { id: 'b', name: 'beta' },
      ],
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(notifySuccess).toHaveBeenCalledWith(
      'Network successfully removed',
      'alpha'
    );
    expect(notifyError).toHaveBeenCalledWith(
      'Unable to remove network beta',
      expect.any(Error)
    );
    restore();
  });

  it('connects a container through the mutation hook', async () => {
    server.use(
      http.post('/api/endpoints/:id/docker/networks/:networkId/connect', () =>
        HttpResponse.json(null, { status: 200 })
      )
    );
    const { result } = renderHook(() => useConnectContainerMutation(1), {
      wrapper: wrap(),
    });
    result.current.mutate({ networkId: 'n1', containerId: 'c1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('disconnects a container through the mutation hook', async () => {
    server.use(
      http.post(
        '/api/endpoints/:id/docker/networks/:networkId/disconnect',
        () => HttpResponse.json(null, { status: 200 })
      )
    );
    const { result } = renderHook(
      () => useDisconnectContainer({ environmentId: 1, networkId: 'n1' }),
      { wrapper: wrap() }
    );
    result.current.mutate({ containerId: 'c1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
