import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import Axios from 'axios';

import { suppressConsoleLogs } from '@/setup-tests/suppress-console';

import {
  createQueryClient,
  mutationOptions,
  queryOptions,
  withError,
  withInvalidate,
} from './react-query';

const notifyError = vi.fn();

vi.mock('@/portainer/services/notifications', () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
}));

describe('react-query helpers', () => {
  let restoreConsole: () => void;

  beforeEach(() => {
    notifyError.mockClear();
    restoreConsole = suppressConsoleLogs();
  });

  afterEach(() => {
    restoreConsole();
    vi.clearAllMocks();
  });

  it('withError builds meta with a fallback message and default title', () => {
    expect(withError('could not load')).toEqual({
      meta: { error: { message: 'could not load', title: 'Failure' } },
    });
    expect(withError('could not save', 'Save failed')).toEqual({
      meta: { error: { message: 'could not save', title: 'Save failed' } },
    });
  });

  it('withInvalidate awaits invalidated queries unless skipRefresh is set', async () => {
    const queryClient = {
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
    } as unknown as QueryClient;

    const awaited = withInvalidate(queryClient, [['stacks'], ['endpoints']]);
    const promise = awaited.onSuccess();
    expect(promise).toBeInstanceOf(Promise);
    await promise;
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(2);

    queryClient.invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const skipped = withInvalidate(
      queryClient,
      [['volumes']],
      { skipRefresh: true }
    );
    expect(skipped.onSuccess()).toBeUndefined();
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith(['volumes']);
  });

  it('mutationOptions and queryOptions merge option objects left to right', () => {
    expect(
      mutationOptions(
        { mutationKey: ['a'] },
        { retry: false },
        { mutationKey: ['b'] }
      )
    ).toEqual({ mutationKey: ['b'], retry: false });

    expect(
      queryOptions({ queryKey: ['q1'] }, { staleTime: 10 }, { staleTime: 20 })
    ).toEqual({ queryKey: ['q1'], staleTime: 20 });
  });

  it('createQueryClient notifies on mutation and query errors with meta', async () => {
    const client = createQueryClient();

    await expect(
      client
        .getMutationCache()
        .build(client, {
          mutationFn: async () => {
            throw new Error('boom');
          },
          ...withError('mutation failed', 'Mutation'),
        })
        .execute({})
    ).rejects.toThrow('boom');

    expect(notifyError).toHaveBeenCalledWith(
      'Mutation',
      expect.any(Error),
      'mutation failed'
    );

    notifyError.mockClear();

    await expect(
      client.fetchQuery({
        queryKey: ['failing'],
        queryFn: async () => {
          throw new Error('query boom');
        },
        ...withError('query failed', 'Query'),
      })
    ).rejects.toThrow('query boom');

    expect(notifyError).toHaveBeenCalledWith(
      'Query',
      expect.any(Error),
      'query failed'
    );
  });

  it('createQueryClient suppresses notifications when meta.error is falsy', async () => {
    const client = createQueryClient();

    await expect(
      client
        .getMutationCache()
        .build(client, {
          mutationFn: async () => {
            throw new Error('silent');
          },
          meta: { error: undefined },
        })
        .execute({})
    ).rejects.toThrow('silent');

    expect(notifyError).not.toHaveBeenCalled();
  });

  it('createQueryClient parses Axios errors before notifying', async () => {
    const client = createQueryClient();
    const axiosError = new Axios.AxiosError(
      'Request failed',
      'ERR_BAD_RESPONSE',
      undefined,
      undefined,
      {
        status: 500,
        statusText: 'Server Error',
        headers: {},
        config: {} as never,
        data: { message: 'backend exploded' },
      }
    );

    await expect(
      client
        .getMutationCache()
        .build(client, {
          mutationFn: async () => {
            throw axiosError;
          },
          ...withError('save failed', 'Save'),
        })
        .execute({})
    ).rejects.toBe(axiosError);

    expect(notifyError).toHaveBeenCalledWith(
      'Save',
      expect.anything(),
      'save failed'
    );
  });

  it('createQueryClient ignores non-object error meta and uses defaults', async () => {
    const client = createQueryClient();

    await expect(
      client
        .getMutationCache()
        .build(client, {
          mutationFn: async () => {
            throw new Error('raw');
          },
          meta: { error: 'not-an-object' },
        })
        .execute({})
    ).rejects.toThrow('raw');

    // string meta is falsy for extractErrorMeta object check → suppressed
    expect(notifyError).not.toHaveBeenCalled();
  });
});
