import { describe, expect, it } from 'vitest';

import { stringEnumValues } from './types';

enum Color {
  Red = 'red',
  Blue = 'blue',
}

describe('stringEnumValues', () => {
  it('returns the string values of a string enum', () => {
    expect(stringEnumValues(Color)).toEqual(['red', 'blue']);
  });
});
