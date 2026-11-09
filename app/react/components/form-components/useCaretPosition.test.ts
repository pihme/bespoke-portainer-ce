import { renderHook, act } from '@testing-library/react-hooks';
import { describe, expect, it } from 'vitest';

import { useCaretPosition } from './useCaretPosition';

describe('useCaretPosition', () => {
  it('exposes ref and updates caret from the input selection', () => {
    const { result } = renderHook(() => useCaretPosition());

    const input = document.createElement('input');
    input.value = 'hello';
    Object.defineProperty(input, 'selectionStart', {
      configurable: true,
      get: () => 1,
    });
    Object.defineProperty(input, 'selectionEnd', {
      configurable: true,
      get: () => 3,
    });
    input.setSelectionRange = () => {};

    // assign ref
    // eslint-disable-next-line no-param-reassign
    (result.current.ref as { current: HTMLInputElement | null }).current =
      input;

    act(() => {
      result.current.updateCaret();
    });

    expect(result.current.start).toBe(1);
    expect(result.current.end).toBe(3);
  });

  it('no-ops updateCaret when ref is unset', () => {
    const { result } = renderHook(() => useCaretPosition());
    act(() => {
      result.current.updateCaret();
    });
    expect(result.current.start).toBe(0);
    expect(result.current.end).toBe(0);
  });
});
