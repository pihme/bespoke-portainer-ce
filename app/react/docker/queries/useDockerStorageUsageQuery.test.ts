import { renderHook } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withTestQueryProvider } from '@/react/test-utils/withTestQuery';

import { useDockerStorageUsageQuery } from './useDockerStorageUsageQuery';

const axiosGet = vi.hoisted(() => vi.fn());

vi.mock('@/portainer/services/axios/axios', () => ({
  default: { get: axiosGet },
  parseAxiosError: (e: unknown, msg: string) => {
    const err = new Error(msg);
    (err as Error & { cause?: unknown }).cause = e;
    return err;
  },
}));

describe('useDockerStorageUsageQuery', () => {
  beforeEach(() => {
    axiosGet.mockReset();
  });

  it('returns storage usage on 200', async () => {
    const payload = {
      rootDir: '/var/lib/docker',
      totalBytes: 100,
      dockerBytes: 40,
      imageBytes: 20,
      containerBytes: 10,
      volumeBytes: 5,
      buildCacheBytes: 5,
      availableBytes: 50,
    };
    axiosGet.mockResolvedValueOnce({ data: payload, status: 200 });
    const Wrapper = withTestQueryProvider(({ children }) => children);
    const { result } = renderHook(() => useDockerStorageUsageQuery(1), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
    expect(axiosGet).toHaveBeenCalledWith(
      '/endpoints/1/agent/host/docker-storage',
      expect.objectContaining({ validateStatus: expect.any(Function) })
    );
    const validateStatus = axiosGet.mock.calls[0][1].validateStatus as (
      s: number
    ) => boolean;
    expect(validateStatus(200)).toBe(true);
    expect(validateStatus(204)).toBe(true);
    expect(validateStatus(500)).toBe(false);
  });

  it('normalises a null 204 body to undefined (react-query rejects undefined data)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    axiosGet.mockResolvedValueOnce({ data: null, status: 204 });
    const Wrapper = withTestQueryProvider(({ children }) => children);
    const { result } = renderHook(() => useDockerStorageUsageQuery(2), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(String(result.current.error)).toMatch(/undefined/i);
    errSpy.mockRestore();
  });

  it('surfaces parseAxiosError when the request fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    axiosGet.mockRejectedValueOnce(new Error('network'));
    const Wrapper = withTestQueryProvider(({ children }) => children);
    const { result } = renderHook(() => useDockerStorageUsageQuery(3), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      message: 'Unable to get Docker storage usage',
    });
    errSpy.mockRestore();
  });

  it('respects enabled=false', async () => {
    const Wrapper = withTestQueryProvider(({ children }) => children);
    const { result } = renderHook(
      () => useDockerStorageUsageQuery(4, { enabled: false }),
      { wrapper: Wrapper }
    );
    expect(result.current.fetchStatus).toBe('idle');
    expect(axiosGet).not.toHaveBeenCalled();
  });
});
