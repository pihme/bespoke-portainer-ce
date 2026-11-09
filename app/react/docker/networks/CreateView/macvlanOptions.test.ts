import { describe, expect, it } from 'vitest';

import { getOptions } from './macvlanOptions';

describe('getOptions', () => {
  it('enables creation when networks already exist', () => {
    const options = getOptions(true);
    expect(options).toHaveLength(2);
    expect(options[0].value).toBe('local');
    expect(options[1].value).toBe('swarm');
    expect(options[1].disabled?.()).toBe(false);
  });

  it('disables creation when there are no networks', () => {
    const options = getOptions(false);
    expect(options[1].disabled?.()).toBe(true);
  });
});
