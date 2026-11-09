import { renderHook, act } from '@testing-library/react-hooks';
import { beforeEach, describe, expect, it } from 'vitest';

import { createPersistedStore, refreshableSettings } from './types';
import {
  useTableState,
  useTableStateWithStorage,
  useTableStateWithoutStorage,
} from './useTableState';

describe('useTableState (backwards compatibility)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('merges persisted settings with search bar state', () => {
    const key = `table-state-${Date.now()}`;
    const store = createPersistedStore(key, 'name', (set) => ({
      ...refreshableSettings(set),
    }));

    const { result } = renderHook(() => useTableState(store, key));

    expect(result.current.sortBy).toEqual({ id: 'name', desc: false });
    expect(result.current.pageSize).toBe(10);
    expect(result.current.search).toBe('');

    act(() => {
      result.current.setSearch('nginx');
      result.current.setPageSize(25);
    });

    expect(result.current.search).toBe('nginx');
    expect(result.current.pageSize).toBe(25);
  });

  it('useTableStateWithStorage creates a persisted store from the storage key', () => {
    const key = `with-storage-${Date.now()}`;
    const { result } = renderHook(() =>
      useTableStateWithStorage(key, 'created')
    );

    expect(result.current.sortBy).toEqual({ id: 'created', desc: false });
    act(() => {
      result.current.setSortBy('name', true);
    });
    expect(result.current.sortBy).toEqual({ id: 'name', desc: true });
  });

  it('useTableStateWithoutStorage keeps ephemeral sort search and page size', () => {
    const { result } = renderHook(() =>
      useTableStateWithoutStorage('name', true)
    );

    expect(result.current).toMatchObject({
      search: '',
      pageSize: 10,
      sortBy: { id: 'name', desc: true },
    });

    act(() => {
      result.current.setSearch('vol');
      result.current.setPageSize(50);
      result.current.setSortBy(undefined, false);
    });

    expect(result.current.search).toBe('vol');
    expect(result.current.pageSize).toBe(50);
    expect(result.current.sortBy).toBeUndefined();
  });

  it('useTableStateWithoutStorage starts unsorted when no default sort key is given', () => {
    const { result } = renderHook(() => useTableStateWithoutStorage());
    expect(result.current.sortBy).toBeUndefined();
  });
});
