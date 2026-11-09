import { act, renderHook } from '@testing-library/react-hooks';

import { useCopy } from './useCopy';

describe('useCopy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test('copies via clipboard API in a secure context', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { result } = renderHook(() => useCopy('hello', 50));

    act(() => {
      result.current.handleCopy();
    });

    expect(writeText).toHaveBeenCalledWith('hello');
    expect(result.current.copiedSuccessfully).toBe(true);
  });

  test('resolves a function copyText and ignores empty values', () => {
    const writeText = vi.fn();
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { result } = renderHook(() => useCopy(() => '', 50));
    act(() => {
      result.current.handleCopy();
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(result.current.copiedSuccessfully).toBe(false);
  });

  test('falls back to execCommand when clipboard API is unavailable', () => {
    vi.stubGlobal('isSecureContext', false);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      writable: true,
      value: execCommand,
    });

    const host = document.createElement('div');
    document.body.appendChild(host);

    const { result } = renderHook(() => useCopy('fallback', 50, host));
    act(() => {
      result.current.handleCopy();
    });

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(result.current.copiedSuccessfully).toBe(true);
    expect(host.querySelector('textarea')).toBeNull();

    host.remove();
  });

  test('clears the copied flag after fadeDelay', () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { result } = renderHook(() => useCopy('timed', 100));
    act(() => {
      result.current.handleCopy();
    });
    expect(result.current.copiedSuccessfully).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.copiedSuccessfully).toBe(false);
  });
});
