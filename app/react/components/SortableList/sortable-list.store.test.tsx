import { renderHook, act } from '@testing-library/react-hooks';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createSortableListStore,
  createSortableListStoreUnpersisted,
  useSortableListState,
} from './sortable-list.store';

describe('sortable-list.store (backwards compatibility)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('createSortableListStoreUnpersisted starts with null group fields and default sort', () => {
    const store = createSortableListStoreUnpersisted('name');
    const state = store.getState();

    expect(state.groupBy).toBeNull();
    expect(state.groupFilter).toBeNull();
    expect(state.sortBy).toEqual({ id: 'name', desc: false });
    expect(state.page).toBe(0);
  });

  it('setGroupBy updates only the groupBy field', () => {
    const store = createSortableListStoreUnpersisted('name');

    act(() => {
      store.getState().setGroupBy('status');
    });

    expect(store.getState().groupBy).toBe('status');
  });

  it('setGroupFilter sets group, toggles desc on the same group, and resets page', () => {
    const store = createSortableListStoreUnpersisted('name');

    act(() => {
      store.getState().setPage(2);
      store.getState().setGroupFilter({ group: 'status', groupValue: 'error' });
    });

    expect(store.getState()).toMatchObject({
      groupBy: 'status',
      groupFilter: 'error',
      page: 0,
      sortBy: { id: 'status', desc: false },
    });

    act(() => {
      store.getState().setGroupFilter({ group: 'status', groupValue: 'healthy' });
    });

    expect(store.getState().sortBy).toEqual({ id: 'status', desc: true });
    expect(store.getState().groupFilter).toBe('healthy');
  });

  it('setGroupFilter starts ascending when switching to a new group', () => {
    const store = createSortableListStoreUnpersisted('name');

    act(() => {
      store.getState().setGroupFilter({ group: 'status', groupValue: null });
      store.getState().setGroupFilter({ group: 'status', groupValue: null });
      store.getState().setGroupFilter({ group: 'name', groupValue: null });
    });

    expect(store.getState().sortBy).toEqual({ id: 'name', desc: false });
    expect(store.getState().groupBy).toBe('name');
  });

  it('createSortableListStore persists settings under the storage key', () => {
    const key = `sortable-list-store-${Date.now()}`;
    const store = createSortableListStore(key, 'color');

    act(() => {
      store.getState().setGroupFilter({ group: 'color', groupValue: 'Red' });
    });

    const persisted = localStorage.getItem(
      Object.keys(localStorage).find((k) => k.includes(key)) ?? ''
    );
    expect(persisted).toBeTruthy();
    expect(store.getState().groupFilter).toBe('Red');
  });

  it('useSortableListState exposes the live table state for a storage key', () => {
    const key = `sortable-hook-${Date.now()}`;
    const { result } = renderHook(() => useSortableListState(key, 'name'));

    expect(result.current.sortBy).toEqual({ id: 'name', desc: false });
    expect(result.current.groupBy).toBeNull();

    act(() => {
      result.current.setGroupFilter({ group: 'status', groupValue: 'error' });
    });

    expect(result.current.groupBy).toBe('status');
    expect(result.current.groupFilter).toBe('error');
    expect(result.current.page).toBe(0);
  });
});
