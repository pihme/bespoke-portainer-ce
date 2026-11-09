import { renderHook, act } from '@testing-library/react-hooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useListState } from './useListState';

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
    sort: 'name',
    order: 'asc',
    groupBy: null,
    groupFilter: null,
    page: 0,
    pageSize: 10,
  };
}

describe('REQ-GIT-02 useListState', () => {
  beforeEach(() => {
    mockState = defaults();
    mockSetState.mockReset();
  });

  it('parses status and type filter enums from the URL', () => {
    mockState = { ...defaults(), status: 'healthy', type: 'git' };

    const { result } = renderHook(() => useListState());

    expect(result.current.status).toBe('healthy');
    expect(result.current.type).toBe('git');
  });

  it('ignores invalid status and type values', () => {
    mockState = { ...defaults(), status: 'nope', type: 'edge' };

    const { result } = renderHook(() => useListState());

    expect(result.current.status).toBeNull();
    expect(result.current.type).toBeNull();
  });

  it('setStatus updates the URL and resets the page', () => {
    const { result } = renderHook(() => useListState());

    act(() => {
      result.current.setStatus('error');
    });

    expect(mockSetState).toHaveBeenCalledWith({ status: 'error', page: 0 });
  });

  it('setType updates the URL and resets the page', () => {
    const { result } = renderHook(() => useListState());

    act(() => {
      result.current.setType('helm');
    });

    expect(mockSetState).toHaveBeenCalledWith({ type: 'helm', page: 0 });
  });
});
