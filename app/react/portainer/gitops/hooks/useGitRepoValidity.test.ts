import { renderHook } from '@testing-library/react-hooks';
import { AxiosError } from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { getGitValidityError, useGitRepoValidity } from './useGitRepoValidity';

const useGitRefs = vi.fn();

vi.mock('../queries/useGitRefs', () => ({
  useGitRefs: (...args: unknown[]) => useGitRefs(...args),
}));

function axiosErr(details: string) {
  const err = new AxiosError('fail');
  err.response = {
    data: { message: 'error', details },
    status: 500,
    statusText: 'err',
    headers: {},
    config: {} as never,
  };
  return err;
}

describe('getGitValidityError', () => {
  it('returns undefined for non-axios errors', () => {
    expect(getGitValidityError(new Error('x'), true)).toBeUndefined();
  });

  it('maps private-repo auth details when credentials are missing', () => {
    expect(
      getGitValidityError(
        axiosErr('Authentication required: Repository not found.'),
        false
      )
    ).toBe(
      'Git repository could not be found or is private, please ensure that the URL is correct or credentials are provided.'
    );
  });

  it('returns details for other axios errors', () => {
    expect(getGitValidityError(axiosErr('boom'), true)).toBe('boom');
  });

  it('returns undefined when axios response has empty details', () => {
    expect(getGitValidityError(axiosErr(''), true)).toBeUndefined();
  });

  it('returns undefined when response data is not the default shape', () => {
    const err = new AxiosError('fail');
    err.response = {
      data: 'raw',
      status: 500,
      statusText: 'err',
      headers: {},
      config: {} as never,
    };
    expect(getGitValidityError(err, true)).toBeUndefined();
  });
});

describe('useGitRepoValidity', () => {
  it('reports valid when query data is present without error', () => {
    const onSettled = vi.fn();
    const onAfterSettle = vi.fn();
    useGitRefs.mockImplementation((_payload, options) => {
      options?.onSettled?.(true);
      return {
        data: true,
        isError: false,
        error: null,
        isInitialLoading: false,
        isFetching: false,
      };
    });

    const { result } = renderHook(() =>
      useGitRepoValidity({
        sourceId: 7,
        enabled: true,
        force: true,
        onSettled,
        onAfterSettle,
      })
    );

    expect(useGitRefs).toHaveBeenCalledWith(
      { sourceId: 7, force: true },
      expect.objectContaining({ enabled: true, suppressError: true })
    );
    expect(result.current.isValid).toBe(true);
    expect(result.current.isChecking).toBe(false);
    expect(result.current.hasError).toBe(false);
    expect(onSettled).toHaveBeenCalledWith(true);
    expect(onAfterSettle).toHaveBeenCalled();
  });

  it('disables the query without a sourceId and surfaces axios errors', () => {
    useGitRefs.mockImplementation((_payload, options) => {
      expect(options.enabled).toBe(false);
      return {
        data: undefined,
        isError: true,
        error: axiosErr('Authentication required: Repository not found.'),
        isInitialLoading: false,
        isFetching: true,
      };
    });

    const { result } = renderHook(() =>
      useGitRepoValidity({ enabled: true })
    );

    expect(result.current.isValid).toBe(false);
    expect(result.current.isChecking).toBe(true);
    expect(result.current.hasError).toBe(true);
    expect(result.current.errorMessage).toMatch(/credentials are provided/);
  });
});
