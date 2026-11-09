import { describe, expect, it } from 'vitest';

import { queryKeys } from './queryKeys';

describe('images queryKeys (backwards compatibility)', () => {
  it('nests image keys under the docker proxy base', () => {
    expect(queryKeys.base(2)).toEqual([[2, 'docker', 'proxy'], 'images']);
    expect(queryKeys.list(2)).toEqual([[2, 'docker', 'proxy'], 'images']);
  });
});
