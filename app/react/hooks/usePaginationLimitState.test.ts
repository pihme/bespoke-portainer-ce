import { renderHook, act } from '@testing-library/react-hooks';
import { describe, it, expect, beforeEach } from 'vitest';

import { keyBuilder } from './useLocalStorage';
import { usePaginationLimitState } from './usePaginationLimitState';

describe('usePaginationLimitState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to 10 and persists updates under a datatable key', () => {
    const { result } = renderHook(() => usePaginationLimitState('containers'));

    expect(result.current[0]).toBe(10);

    act(() => {
      result.current[1](50);
    });

    expect(result.current[0]).toBe(50);
    expect(
      localStorage.getItem(keyBuilder('datatable_pagination_containers'))
    ).toBe('50');
  });
});
