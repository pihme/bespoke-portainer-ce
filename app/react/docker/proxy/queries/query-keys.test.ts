import { describe, expect, it } from 'vitest';

import { queryKeys } from './query-keys';

describe('proxy queryKeys (backwards compatibility)', () => {
  it('builds the base and events keys for an environment', () => {
    expect(queryKeys.base(3)).toEqual([3, 'docker', 'proxy']);
    expect(queryKeys.events(3)).toEqual([3, 'docker', 'proxy', 'events', undefined]);
    expect(queryKeys.events(3, { since: 1 })).toEqual([
      3,
      'docker',
      'proxy',
      'events',
      { since: 1 },
    ]);
  });
});
