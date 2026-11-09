import { renderHook, act } from '@testing-library/react-hooks';

import { useStore } from './store';

describe('REQ-STK-01 stacks datatable store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists orphaned-stacks visibility and column settings', () => {
    const { result } = renderHook(() => useStore());

    expect(result.current.showOrphanedStacks).toBe(false);
    expect(result.current.sortBy).toEqual({ id: 'name', desc: false });

    act(() => {
      result.current.setShowOrphanedStacks(true);
      result.current.setHiddenColumns(['type']);
      result.current.setAutoRefreshRate(15000);
      result.current.setColumnFilters([{ id: 'type', value: ['Compose'] }]);
    });

    expect(result.current.showOrphanedStacks).toBe(true);
    expect(result.current.hiddenColumns).toEqual(['type']);
    expect(result.current.autoRefreshRateMS).toBe(15000);
    expect(result.current.columnFilters).toEqual([
      { id: 'type', value: ['Compose'] },
    ]);
  });
});
