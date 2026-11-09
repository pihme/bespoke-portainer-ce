import { describe, expect, it } from 'vitest';

import { buildUrl } from './build-url';

describe('REQ-ENV-03 environment group buildUrl', () => {
  it('builds list, detail and action URLs', () => {
    expect(buildUrl()).toBe('/endpoint_groups');
    expect(buildUrl(3)).toBe('/endpoint_groups/3');
    expect(buildUrl(3, 'access')).toBe('/endpoint_groups/3/access');
  });
});
