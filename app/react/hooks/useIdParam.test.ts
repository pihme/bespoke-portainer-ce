import { renderHook } from '@testing-library/react-hooks';
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockParams: Record<string, unknown> = {};

vi.mock('@uirouter/react', () => ({
  useCurrentStateAndParams: () => ({ params: mockParams }),
}));

import { useIdParam } from './useIdParam';

describe('useIdParam', () => {
  beforeEach(() => {
    mockParams = {};
  });

  it('parses the default id param as a number', () => {
    mockParams = { id: '42' };
    const { result } = renderHook(() => useIdParam());
    expect(result.current).toBe(42);
  });

  it('reads a custom param name', () => {
    mockParams = { stackId: '7' };
    const { result } = renderHook(() => useIdParam('stackId'));
    expect(result.current).toBe(7);
  });

  it('errors when the param is missing or not a number', () => {
    mockParams = {};
    expect(renderHook(() => useIdParam()).result.error?.message).toMatch(
      /id url param is required/
    );

    mockParams = { id: 'abc' };
    expect(renderHook(() => useIdParam()).result.error?.message).toMatch(
      /id url param is required/
    );

    mockParams = { id: '0' };
    expect(renderHook(() => useIdParam()).result.error?.message).toMatch(
      /id url param is required/
    );
  });
});
