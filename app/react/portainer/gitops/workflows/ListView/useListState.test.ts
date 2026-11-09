import { renderHook, act } from '@testing-library/react-hooks';

import { useListState, SORT_KEYS } from './useListState';

const useTableStateFromUrl = vi.fn();

vi.mock('@@/datatables/useTableStateFromUrl', () => ({
  useTableStateFromUrl: (...args: unknown[]) => useTableStateFromUrl(...args),
}));
vi.mock('@@/datatables/groupSortState', () => ({
  buildGroupSortExtras: () => ({ groupExtras: true }),
}));

describe('useListState', () => {
  it('configures table state for workflow status filtering', () => {
    useTableStateFromUrl.mockImplementation((opts) => {
      const parsed = opts.parseExtra({ status: 'healthy' });
      const extras = opts.buildExtra(
        { status: 'healthy' },
        vi.fn()
      );
      return { parsed, extras, sortKeys: SORT_KEYS };
    });

    const { result } = renderHook(() => useListState());
    expect(result.current.parsed.status).toBe('healthy');
    expect(result.current.extras.groupExtras).toBe(true);
    expect(SORT_KEYS).toContain('lastSyncDate');
  });

  it('setStatus resets the page when filtering', () => {
    const setUrlState = vi.fn();
    useTableStateFromUrl.mockImplementation((opts) => {
      const extras = opts.buildExtra({ status: null }, setUrlState);
      return extras;
    });

    const { result } = renderHook(() => useListState());
    act(() => {
      result.current.setStatus('error');
    });
    expect(setUrlState).toHaveBeenCalledWith({ status: 'error', page: 0 });
  });
});
