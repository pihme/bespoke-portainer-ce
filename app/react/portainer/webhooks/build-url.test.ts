import { describe, expect, it } from 'vitest';

import { buildUrl } from './build-url';

describe('webhooks buildUrl', () => {
  it('returns collection and item paths', () => {
    expect(buildUrl()).toBe('/webhooks');
    expect(buildUrl(12)).toBe('/webhooks/12');
  });
});
