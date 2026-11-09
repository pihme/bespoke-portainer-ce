import { renderHook } from '@testing-library/react-hooks';
import { describe, expect, it, vi } from 'vitest';

import { useGoToHighlightedRow } from './useGoToHighlightedRow';

type Item = { id: string };

const rows: Item[] = Array.from({ length: 25 }, (_, i) => ({
  id: `row-${i}`,
}));

describe('useGoToHighlightedRow (backwards compatibility)', () => {
  it('does nothing for server-side pagination', () => {
    const goToPage = vi.fn();
    renderHook(() =>
      useGoToHighlightedRow(true, 10, rows, goToPage, 'row-15')
    );
    expect(goToPage).not.toHaveBeenCalled();
  });

  it('does nothing when highlightedItemId is missing', () => {
    const goToPage = vi.fn();
    renderHook(() => useGoToHighlightedRow(false, 10, rows, goToPage));
    expect(goToPage).not.toHaveBeenCalled();
  });

  it('skips navigation when getRowPage returns 0 (pageSize covers all rows)', () => {
    // Observed: `if (page)` treats page 0 as falsy, so goToPage is not called.
    const goToPage = vi.fn();
    renderHook(() =>
      useGoToHighlightedRow(false, 50, rows, goToPage, 'row-3')
    );
    expect(goToPage).not.toHaveBeenCalled();
  });

  it('navigates to the page that contains the highlighted row', () => {
    const goToPage = vi.fn();
    renderHook(() =>
      useGoToHighlightedRow(false, 10, rows, goToPage, 'row-15')
    );
    expect(goToPage).toHaveBeenCalledWith(1);
  });

  it('does not navigate again for the same highlighted id', () => {
    const goToPage = vi.fn();
    const { rerender } = renderHook(
      ({ id }) => useGoToHighlightedRow(false, 10, rows, goToPage, id),
      { initialProps: { id: 'row-22' } }
    );
    expect(goToPage).toHaveBeenCalledTimes(1);
    expect(goToPage).toHaveBeenCalledWith(2);

    rerender({ id: 'row-22' });
    expect(goToPage).toHaveBeenCalledTimes(1);
  });
});
