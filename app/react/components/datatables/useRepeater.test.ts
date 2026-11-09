import { renderHook, act } from '@testing-library/react-hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRepeater } from './useRepeater';

describe('useRepeater (backwards compatibility)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call onRefresh when refreshRateMS is 0', () => {
    const onRefresh = vi.fn();
    renderHook(() => useRepeater(0, onRefresh));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('does not start when onRefresh is omitted', () => {
    renderHook(() => useRepeater(1000));

    act(() => {
      vi.advanceTimersByTime(5000);
    });
  });

  it('calls onRefresh on the refresh interval and stops when rate becomes 0', () => {
    const onRefresh = vi.fn();
    const { rerender } = renderHook(
      ({ rate }) => useRepeater(rate, onRefresh),
      { initialProps: { rate: 1000 } }
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);

    rerender({ rate: 0 });

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });
});
