import { describe, expect, it } from 'vitest';

import { getValueAsArrayOfStrings } from './array';

describe('array getValueAsArrayOfStrings', () => {
  it('returns the same array when the value is already an array', () => {
    const input = ['a', 'b'];
    expect(getValueAsArrayOfStrings(input)).toBe(input);
  });

  it('wraps a string in a one-element array', () => {
    expect(getValueAsArrayOfStrings('solo')).toEqual(['solo']);
  });

  it('stringifies a number into a one-element array', () => {
    expect(getValueAsArrayOfStrings(42)).toEqual(['42']);
  });

  it('returns an empty array for null, undefined, objects and booleans', () => {
    expect(getValueAsArrayOfStrings(null)).toEqual([]);
    expect(getValueAsArrayOfStrings(undefined)).toEqual([]);
    expect(getValueAsArrayOfStrings({ a: 1 })).toEqual([]);
    expect(getValueAsArrayOfStrings(true)).toEqual([]);
    expect(getValueAsArrayOfStrings(false)).toEqual([]);
    expect(getValueAsArrayOfStrings(0)).toEqual([]);
    expect(getValueAsArrayOfStrings('')).toEqual([]);
  });
});
