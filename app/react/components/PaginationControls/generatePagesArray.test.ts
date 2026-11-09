import { generatePagesArray } from './generatePagesArray';

describe('generatePagesArray', () => {
  it('lists all pages when they fit in the range', () => {
    expect(generatePagesArray(1, 3, 5)).toEqual([1, 2, 3]);
  });

  it('inserts ellipses for a long list in the middle', () => {
    const pages = generatePagesArray(10, 20, 5);
    expect(pages).toContain('...');
    expect(pages[0]).toBe(1);
    expect(pages[pages.length - 1]).toBe(20);
  });

  it('handles start and end positions', () => {
    expect(generatePagesArray(1, 20, 5)[0]).toBe(1);
    expect(generatePagesArray(20, 20, 5).at(-1)).toBe(20);
  });
});
