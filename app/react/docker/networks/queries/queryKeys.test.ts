import { describe, expect, it } from 'vitest';

import { queryKeys } from './queryKeys';

describe('networks queryKeys', () => {
  it('builds base, list, and item keys for an environment', () => {
    expect(queryKeys.base(3)).toEqual(
      expect.arrayContaining(['networks'])
    );
    expect(queryKeys.list(3, { local: true })).toEqual(
      expect.arrayContaining(['list', { local: true }])
    );
    expect(queryKeys.item(3, 'net-1')).toEqual(
      expect.arrayContaining(['net-1'])
    );
  });
});
