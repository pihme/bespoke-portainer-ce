import { describe, expect, it } from 'vitest';

import { columnHelper } from './helper';

describe('stacks columns helper', () => {
  it('exposes a tanstack column helper', () => {
    expect(columnHelper.accessor).toBeTypeOf('function');
    expect(columnHelper.display).toBeTypeOf('function');
  });
});
