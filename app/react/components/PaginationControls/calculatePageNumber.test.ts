import { calculatePageNumber } from './calculatePageNumber';

describe('calculatePageNumber', () => {
  it('returns first and last positions', () => {
    expect(calculatePageNumber(1, 5, 5, 20)).toBe(1);
    expect(calculatePageNumber(5, 5, 5, 20)).toBe(20);
  });

  it('shifts when near the end or middle', () => {
    expect(calculatePageNumber(3, 18, 5, 20)).toBe(18);
    expect(calculatePageNumber(3, 10, 5, 20)).toBe(10);
  });

  it('returns the position when the range covers all pages', () => {
    expect(calculatePageNumber(2, 1, 5, 3)).toBe(2);
  });
});
