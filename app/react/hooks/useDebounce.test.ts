import { renderHook, act } from '@testing-library/react-hooks';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value and updates the local value immediately', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDebounce('a', onChange, 200));

    expect(result.current[0]).toBe('a');

    act(() => {
      result.current[1]('b');
    });

    expect(result.current[0]).toBe('b');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('invokes onChange after the delay with the callback from the change', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useDebounce('a', onChange, 200));

    act(() => {
      result.current[1]('b');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('passes the current onChange when handleChange runs again', () => {
    const first = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useDebounce('a', cb, 200),
      { initialProps: { cb: first } }
    );

    act(() => {
      result.current[1]('x');
    });

    const second = vi.fn();
    rerender({ cb: second });

    act(() => {
      result.current[1]('y');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // lodash debounce keeps the latest invocation args
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('y');
  });

  it('syncs the local value when the controlled value prop changes', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, onChange, 100),
      { initialProps: { value: 'first' } }
    );

    expect(result.current[0]).toBe('first');

    rerender({ value: 'second' });

    expect(result.current[0]).toBe('second');
  });
});
