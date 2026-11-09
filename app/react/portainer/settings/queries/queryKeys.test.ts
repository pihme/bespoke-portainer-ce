import { describe, expect, it } from 'vitest';

import { queryKeys } from './queryKeys';

describe('settings queryKeys', () => {
  it('builds base, public and experimental keys', () => {
    expect(queryKeys.base()).toEqual(['settings']);
    expect(queryKeys.public()).toEqual(['settings', 'public']);
    expect(queryKeys.experimental()).toEqual(['settings', 'experimental']);
  });
});
