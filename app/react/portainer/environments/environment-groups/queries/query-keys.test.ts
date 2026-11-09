import { describe, expect, it } from 'vitest';

import { queryKeys } from './query-keys';

describe('environment group queryKeys', () => {
  it('builds stable list and group keys', () => {
    expect(queryKeys.base()).toEqual(['environment-groups']);
    expect(queryKeys.list()).toEqual(['environment-groups', { size: false }]);
    expect(queryKeys.list(true)).toEqual(['environment-groups', { size: true }]);
    expect(queryKeys.group(5)).toEqual([
      'environment-groups',
      5,
      { size: false },
    ]);
  });
});
