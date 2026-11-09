import { describe, expect, it } from 'vitest';

import $allSettled from './allSettled';

describe('allSettled helper (backwards compatibility)', () => {
  it('splits fulfilled and rejected promises', async () => {
    const result = await $allSettled([
      Promise.resolve('ok'),
      Promise.reject(new Error('nope')),
      Promise.resolve(2),
    ]);
    expect(result.fulfilled).toEqual(['ok', 2]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toMatchObject({ message: 'nope' });
  });

  it('returns empty buckets for an empty input', async () => {
    await expect($allSettled([])).resolves.toEqual({ fulfilled: [], rejected: [] });
  });
});
