import { renderHook } from '@testing-library/react-hooks';
import { describe, it, expect } from 'vitest';

import { useId } from './useId';

describe('useId', () => {
  it('returns a stable unique id per instance', () => {
    const first = renderHook(() => useId());
    const second = renderHook(() => useId());

    expect(first.result.current).toMatch(/^ps-id-\d+$/);
    expect(second.result.current).toMatch(/^ps-id-\d+$/);
    expect(first.result.current).not.toBe(second.result.current);

    first.rerender();
    expect(first.result.current).toBe(first.result.current);
  });
});
