import { describe, expect, it } from 'vitest';

import { compose, kubernetes } from './deployment-methods';

describe('BoxSelector deployment-methods options', () => {
  it('exposes compose and kubernetes options', () => {
    expect(compose.value).toBe('compose');
    expect(compose.label).toBe('Compose');
    expect(kubernetes.value).toBe('kubernetes');
  });
});
