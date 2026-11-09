import { renderHook, act } from '@testing-library/react-hooks';
import { describe, it, expect } from 'vitest';

import { useListSelection } from './useListSelection';

describe('useListSelection', () => {
  it('starts empty by default and selects then deselects by identity', () => {
    const { result } = renderHook(() => useListSelection<string>());

    expect(result.current[0]).toEqual([]);

    act(() => {
      result.current[1]('a', true);
    });
    expect(result.current[0]).toEqual(['a']);

    act(() => {
      result.current[1]('a', false);
    });
    expect(result.current[0]).toEqual([]);
  });

  it('uses a custom compare function when deselecting', () => {
    type Item = { id: number; label: string };
    const { result } = renderHook(() =>
      useListSelection<Item>([{ id: 1, label: 'one' }], (a, b) => a.id === b.id)
    );

    act(() => {
      result.current[1]({ id: 2, label: 'two' }, true);
    });
    expect(result.current[0]).toHaveLength(2);

    act(() => {
      result.current[1]({ id: 1, label: 'renamed' }, false);
    });
    expect(result.current[0]).toEqual([{ id: 2, label: 'two' }]);
  });
});
