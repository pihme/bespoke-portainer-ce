import { describe, expect, it } from 'vitest';
import { array, object, string, ValidationError } from 'yup';

import { buildUniquenessTest } from './validate-unique';

describe('buildUniquenessTest', () => {
  it('passes when list is undefined or unique', () => {
    const test = buildUniquenessTest((i) => `dup ${i}`);
    expect(test(undefined, { path: 'items' } as never)).toBe(true);
    expect(test(['a', 'b'], { path: 'items' } as never)).toBe(true);
  });

  it('throws ValidationError for duplicate plain values', () => {
    const test = buildUniquenessTest((i) => `dup at ${i}`);
    expect(() => test(['a', 'b', 'a'], { path: 'items' } as never)).toThrow(
      ValidationError
    );
    try {
      test(['a', 'b', 'a'], { path: 'items' } as never);
    } catch (e) {
      const err = e as ValidationError;
      expect(err.inner.map((x) => x.message)).toContain('dup at 2');
      expect(err.inner[0].path).toBe('items[2]');
    }
  });

  it('checks uniqueness by nested path', () => {
    const schema = array(
      object({ name: string() })
    ).test(
      'unique',
      'dup',
      buildUniquenessTest(() => 'dup name', 'name')
    );

    expect(() =>
      schema.validateSync(
        [
          { name: 'FOO' },
          { name: 'BAR' },
          { name: 'FOO' },
        ],
        { abortEarly: false }
      )
    ).toThrow(/dup name/);
  });
});
