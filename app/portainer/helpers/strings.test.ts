import { describe, expect, it } from 'vitest';

import { addPlural, grammaticallyJoin, pluralize } from './strings';

describe('strings re-exports', () => {
  it('pluralize picks singular for 1 and -1 and plural otherwise', () => {
    expect(pluralize(1, 'stack')).toBe('stack');
    expect(pluralize(-1, 'stack')).toBe('stack');
    expect(pluralize(0, 'stack')).toBe('stacks');
    expect(pluralize(2, 'stack', 'stacken')).toBe('stacken');
  });

  it('addPlural prefixes the count', () => {
    expect(addPlural(1, 'endpoint')).toBe('1 endpoint');
    expect(addPlural(3, 'endpoint')).toBe('3 endpoints');
  });

  it('grammaticallyJoin builds a readable list', () => {
    expect(grammaticallyJoin([])).toBe('');
    expect(grammaticallyJoin(['a'])).toBe('a');
    expect(grammaticallyJoin(['a', 'b'])).toBe('a and b');
    expect(grammaticallyJoin(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
