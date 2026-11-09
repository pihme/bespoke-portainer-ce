import { describe, expect, it, vi } from 'vitest';
import { ColumnFiltersState, RowSelectionState, TableOptions } from '@tanstack/react-table';

import { mergeOptions } from './mergeOptions';
import { withColumnFilters } from './withColumnFilters';
import { withControlledSelected } from './withControlledSelected';
import { withGlobalFilter } from './withGlobalFilter';
import { withMeta } from './withMeta';

type Row = { id: string; name: string };

function baseOptions(): TableOptions<Row> {
  return {
    data: [],
    columns: [],
    getCoreRowModel: vi.fn() as never,
    state: {},
  } as unknown as TableOptions<Row>;
}

describe('mergeOptions', () => {
  it('applies extenders left to right', () => {
    const first = (options: TableOptions<Row>) => ({
      ...options,
      meta: { ...(options.meta || {}), a: 1 },
    });
    const second = (options: TableOptions<Row>) => ({
      ...options,
      meta: { ...(options.meta || {}), b: 2 },
    });

    const merged = mergeOptions(first, second)(baseOptions());
    expect(merged.meta).toEqual({ a: 1, b: 2 });
  });

  it('returns the original options when no extenders are given', () => {
    const options = baseOptions();
    expect(mergeOptions()(options)).toBe(options);
  });
});

describe('withColumnFilters', () => {
  it('wires column filter state and notifies onChange for value and updater', () => {
    const filters: ColumnFiltersState = [{ id: 'name', value: 'web' }];
    const onChange = vi.fn();
    const extended = withColumnFilters<Row>(filters, onChange)(baseOptions());

    expect(extended.state?.columnFilters).toEqual(filters);
    expect(extended.initialState?.columnFilters).toEqual(filters);

    extended.onColumnFiltersChange?.([{ id: 'name', value: 'api' }]);
    expect(onChange).toHaveBeenCalledWith([{ id: 'name', value: 'api' }]);

    onChange.mockClear();
    extended.onColumnFiltersChange?.((prev) => [
      ...prev,
      { id: 'status', value: 'up' },
    ]);
    expect(onChange).toHaveBeenCalledWith([
      { id: 'name', value: 'web' },
      { id: 'status', value: 'up' },
    ]);
  });
});

describe('withControlledSelected', () => {
  it('returns original options when onChange or value is missing', () => {
    const options = baseOptions();
    expect(withControlledSelected<Row>()(options)).toBe(options);
    expect(withControlledSelected<Row>(vi.fn())(options)).toBe(options);
    expect(withControlledSelected<Row>(undefined, ['1'])(options)).toBe(options);
  });

  it('maps selected ids into rowSelection and reports selected ids on change', () => {
    const onChange = vi.fn();
    const extended = withControlledSelected<Row>(onChange, ['a', 'c'])(
      baseOptions()
    );

    expect(extended.state?.rowSelection).toEqual({ a: true, c: true });

    extended.onRowSelectionChange?.({ a: true, b: true, c: false });
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);

    onChange.mockClear();
    extended.onRowSelectionChange?.((prev: RowSelectionState) => ({
      ...prev,
      b: true,
    }));
    expect(onChange).toHaveBeenCalledWith(['a', 'c', 'b']);
  });
});

describe('withGlobalFilter', () => {
  it('sets the provided globalFilterFn', () => {
    const filterFn = vi.fn();
    const extended = withGlobalFilter(filterFn as never)(baseOptions());
    expect(extended.globalFilterFn).toBe(filterFn);
  });
});

describe('withMeta', () => {
  it('merges meta onto existing table options', () => {
    const options = {
      ...baseOptions(),
      meta: { table: 'containers' },
    };
    const extended = withMeta<Row>({ page: 'list' })(options);
    expect(extended.meta).toEqual({ table: 'containers', page: 'list' });
  });
});
