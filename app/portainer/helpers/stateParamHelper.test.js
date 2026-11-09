import { describe, it, expect } from 'vitest';

import { filterParam, paginationParams } from './stateParamHelper.js';

describe('stateParamHelper UI-router filter and pagination params', () => {
  it('filterParam defaults to a squashed dynamic null value', () => {
    expect(filterParam()).toEqual({ value: null, squash: true, dynamic: true });
  });

  it('filterParam keeps an explicit default value', () => {
    expect(filterParam('name')).toEqual({ value: 'name', squash: true, dynamic: true });
  });

  it('paginationParams wires search, sort, order, page and pageSize', () => {
    expect(paginationParams()).toEqual({
      search: { value: null, squash: true, dynamic: true },
      sort: { value: 'name', squash: true, dynamic: true },
      order: { value: 'asc', squash: true, dynamic: true },
      page: { value: '0', squash: true, dynamic: true },
      pageSize: { value: null, squash: true, dynamic: true },
    });
  });

  it('paginationParams accepts a custom default sort key', () => {
    expect(paginationParams('created').sort).toEqual({
      value: 'created',
      squash: true,
      dynamic: true,
    });
  });
});
