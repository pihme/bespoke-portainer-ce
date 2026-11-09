import { describe, expect, it, beforeEach } from 'vitest';
import { createStore } from 'zustand';

import {
  backendPaginationSettings,
  createPersistedStore,
  createTableStore,
  filteredColumnsSettings,
  hiddenColumnsSettings,
  paginationSettings,
  refreshableSettings,
  sortableSettings,
  BasicTableSettings,
  PaginationTableSettings,
  BackendPaginationTableSettings,
  SortableTableSettings,
  SettableColumnsTableSettings,
  RefreshableTableSettings,
  FilteredColumnsTableSettings,
} from './types';

describe('datatable types settings (backwards compatibility)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('paginationSettings defaults pageSize to 10 and updates via setPageSize', () => {
    const store = createStore<PaginationTableSettings>()((set) =>
      paginationSettings(set)
    );

    expect(store.getState().pageSize).toBe(10);
    store.getState().setPageSize(25);
    expect(store.getState().pageSize).toBe(25);
  });

  it('backendPaginationSettings defaults page to 0 and updates via setPage', () => {
    const store = createStore<BackendPaginationTableSettings>()((set) =>
      backendPaginationSettings(set)
    );

    expect(store.getState().page).toBe(0);
    store.getState().setPage(3);
    expect(store.getState().page).toBe(3);
  });

  it('sortableSettings accepts a string initial sort and clears sortBy with undefined id', () => {
    const store = createStore<SortableTableSettings>()((set) =>
      sortableSettings(set, 'name')
    );

    expect(store.getState().sortBy).toEqual({ id: 'name', desc: false });
    store.getState().setSortBy('age', true);
    expect(store.getState().sortBy).toEqual({ id: 'age', desc: true });
    store.getState().setSortBy(undefined, false);
    expect(store.getState().sortBy).toBeUndefined();
  });

  it('sortableSettings accepts an object initial sort', () => {
    const store = createStore<SortableTableSettings>()((set) =>
      sortableSettings(set, { id: 'created', desc: true })
    );

    expect(store.getState().sortBy).toEqual({ id: 'created', desc: true });
  });

  it('hiddenColumnsSettings starts empty or with initial columns and updates', () => {
    const empty = createStore<SettableColumnsTableSettings>()((set) =>
      hiddenColumnsSettings(set)
    );
    expect(empty.getState().hiddenColumns).toEqual([]);

    const seeded = createStore<SettableColumnsTableSettings>()((set) =>
      hiddenColumnsSettings(set, ['select'])
    );
    expect(seeded.getState().hiddenColumns).toEqual(['select']);
    seeded.getState().setHiddenColumns(['name']);
    expect(seeded.getState().hiddenColumns).toEqual(['name']);
  });

  it('refreshableSettings defaults autoRefreshRateMS and updates it', () => {
    const store = createStore<RefreshableTableSettings>()((set) =>
      refreshableSettings(set)
    );
    expect(store.getState().autoRefreshRateMS).toBe(0);
    store.getState().setAutoRefreshRate(10000);
    expect(store.getState().autoRefreshRateMS).toBe(10000);

    const seeded = createStore<RefreshableTableSettings>()((set) =>
      refreshableSettings(set, 5000)
    );
    expect(seeded.getState().autoRefreshRateMS).toBe(5000);
  });

  it('filteredColumnsSettings starts with empty filters and replaces them', () => {
    const store = createStore<FilteredColumnsTableSettings>()((set) =>
      filteredColumnsSettings(set)
    );
    expect(store.getState().columnFilters).toEqual([]);
    store.getState().setColumnFilters([{ id: 'status', value: ['running'] }]);
    expect(store.getState().columnFilters).toEqual([
      { id: 'status', value: ['running'] },
    ]);
  });

  it('createTableStore combines sort and pagination without persistence', () => {
    const store = createTableStore('name');
    const state = store.getState();

    expect(state.sortBy).toEqual({ id: 'name', desc: false });
    expect(state.pageSize).toBe(10);
    state.setPageSize(50);
    expect(store.getState().pageSize).toBe(50);
  });

  it('createPersistedStore persists settings under a datatable storage key', () => {
    const key = `types-persist-${Date.now()}`;
    type Settings = BasicTableSettings & RefreshableTableSettings;
    const store = createPersistedStore<Settings>(key, 'name', (set) => ({
      ...refreshableSettings(set),
    }));

    store.getState().setPageSize(20);
    store.getState().setAutoRefreshRate(30000);

    const persistedKey = Object.keys(localStorage).find((k) =>
      k.includes(`datatable_settings_${key}`)
    );
    expect(persistedKey).toBeTruthy();
    expect(store.getState().pageSize).toBe(20);
    expect(store.getState().autoRefreshRateMS).toBe(30000);
  });
});
