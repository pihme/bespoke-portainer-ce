import { createStore, TRUNCATE_LENGTH } from './datatable-store';

describe('REQ-CTR-01 containers datatable store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a persisted store with truncate default and setters', () => {
    const key = `containers-store-${Date.now()}`;
    const store = createStore(key);
    const state = store.getState();

    expect(TRUNCATE_LENGTH).toBe(32);
    expect(state.truncateContainerName).toBe(TRUNCATE_LENGTH);
    expect(state.hiddenQuickActions).toEqual([]);
    expect(state.sortBy).toEqual({ id: 'name', desc: false });

    state.setTruncateContainerName(0);
    expect(store.getState().truncateContainerName).toBe(0);

    state.setHiddenQuickActions(['logs', 'stats']);
    expect(store.getState().hiddenQuickActions).toEqual(['logs', 'stats']);

    state.setHiddenColumns(['ip']);
    expect(store.getState().hiddenColumns).toEqual(['ip']);

    state.setAutoRefreshRate(15000);
    expect(store.getState().autoRefreshRateMS).toBe(15000);

    state.setColumnFilters([{ id: 'state', value: ['running'] }]);
    expect(store.getState().columnFilters).toEqual([
      { id: 'state', value: ['running'] },
    ]);
  });
});
