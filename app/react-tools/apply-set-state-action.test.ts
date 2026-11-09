import { describe, expect, it } from 'vitest';

import { applySetStateAction } from './apply-set-state-action';

describe('applySetStateAction', () => {
  it('returns a plain value when the applier is not a function', () => {
    expect(applySetStateAction({ name: 'next' }, { name: 'prev' })).toEqual({
      name: 'next',
    });
    expect(applySetStateAction(7, 3)).toBe(7);
    expect(applySetStateAction(null, 'kept')).toBeNull();
  });

  it('invokes a functional updater with the previous values', () => {
    const result = applySetStateAction(
      (prev: { count: number }) => ({ count: prev.count + 1 }),
      { count: 4 }
    );
    expect(result).toEqual({ count: 5 });
  });
});
