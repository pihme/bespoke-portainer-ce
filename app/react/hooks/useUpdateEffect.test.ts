import { renderHook } from '@testing-library/react-hooks';
import { describe, it, expect, vi } from 'vitest';

import { useUpdateEffect } from './useUpdateEffect';

describe('useUpdateEffect', () => {
  it('skips the first render and runs on later dependency changes', () => {
    const fn = vi.fn();
    const { rerender } = renderHook(
      ({ dep }) => useUpdateEffect(fn, [dep]),
      { initialProps: { dep: 1 } }
    );

    expect(fn).not.toHaveBeenCalled();

    rerender({ dep: 2 });
    expect(fn).toHaveBeenCalledTimes(1);

    rerender({ dep: 2 });
    expect(fn).toHaveBeenCalledTimes(1);

    rerender({ dep: 3 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
