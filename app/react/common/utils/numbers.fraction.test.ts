import { describe, expect, it } from 'vitest';

import { abbreviateNumber } from './numbers';

describe('abbreviateNumber fractional values', () => {
  it('keeps values below 1 without a suffix (exponent clamped to 0)', () => {
    expect(abbreviateNumber(0.5)).toBe('0');
    expect(abbreviateNumber(0.9, 0)).toBe('0');
    expect(abbreviateNumber(0.001, 1)).toBe('0');
  });
});
