import { describe, expect, it } from 'vitest';

import { queryKeys } from './query-keys';

describe('webhooks queryKeys', () => {
  it('builds base and list keys', () => {
    expect(queryKeys.base()).toEqual(['webhooks']);
    expect(queryKeys.list({ endpointId: 1, resourceId: 'c' })).toEqual([
      'webhooks',
      { filters: { endpointId: 1, resourceId: 'c' } },
    ]);
  });
});
