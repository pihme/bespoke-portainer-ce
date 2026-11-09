import { renderHook, act } from '@testing-library/react-hooks';
import { describe, it, expect, vi } from 'vitest';

import { useStateWrapper } from './useStateWrapper';

describe('useStateWrapper', () => {
  it('mirrors the controlled value and notifies onChange', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useStateWrapper(value, onChange),
      { initialProps: { value: 'a' } }
    );

    expect(result.current[0]).toBe('a');

    act(() => {
      result.current[1]('b');
    });

    expect(result.current[0]).toBe('b');
    expect(onChange).toHaveBeenCalledWith('b');

    rerender({ value: 'c' });
    expect(result.current[0]).toBe('c');
  });
});
