import { renderHook, act } from '@testing-library/react-hooks';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useHomeViewState } from './useHomeViewState';

const mockSetState = vi.fn();
let mockState: Record<string, unknown> = {};

vi.mock('@/react/hooks/useParamState', () => ({
  usePersistedParamsState: (
    parse: (params: Record<string, unknown>) => Record<string, unknown>
  ) => [parse(mockState), mockSetState] as const,
}));

function defaults(): Record<string, unknown> {
  return {
    search: '',
    sort: 'Id',
    order: 'asc',
    groupBy: 'Id',
    groupFilter: null,
    page: 0,
    pageSize: 10,
  };
}

describe('useHomeViewState', () => {
  beforeEach(() => {
    mockState = defaults();
    mockSetState.mockReset();
  });

  it('defaults groupKey to Id for the local home list', () => {
    const { result } = renderHook(() => useHomeViewState());
    expect(result.current.groupKey).toBe('Id');
  });

  it('resolves groupKey from URL groupBy', () => {
    mockState = { ...defaults(), groupBy: 'Name' };
    const { result } = renderHook(() => useHomeViewState());
    expect(result.current.groupKey).toBe('Name');
  });

  it('setHeaderFilter updates group URL state', () => {
    const { result } = renderHook(() => useHomeViewState());

    act(() => {
      result.current.setHeaderFilter('Name', 'prod');
    });

    expect(mockSetState).toHaveBeenCalledWith({
      groupBy: 'Name',
      groupFilter: 'prod',
      order: 'asc',
      page: 0,
      search: '',
    });
  });

  it('falls back to Id when groupBy is empty', () => {
    mockState = { ...defaults(), groupBy: null };
    const { result } = renderHook(() => useHomeViewState());
    expect(result.current.groupKey).toBe('Id');
  });
});
