import { describe, expect, it } from 'vitest';

import { sortOptionsFromColumns, withSortQuery } from './sort.types';

const sortOptions = sortOptionsFromColumns([
  { id: 'one', enableSorting: true },
  { id: 'skipped', enableSorting: false },
  { accessorKey: 'three', enableSorting: true },
]);

describe('sort.types uncovered arms', () => {
  it('withSortQuery returns defaults when sortBy is absent', () => {
    expect(withSortQuery(undefined, sortOptions)).toEqual({
      sort: undefined,
      order: 'asc',
    });
  });

  it('sortOptionsFromColumns skips columns with enableSorting false', () => {
    expect(sortOptions).toEqual(['one', 'three']);
  });
});
