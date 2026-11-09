import { renderHook } from '@testing-library/react-hooks';
import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockParams: Record<string, unknown> = {};

vi.mock('@uirouter/react', () => ({
  useCurrentStateAndParams: () => ({ params: mockParams }),
}));

import { useEnvironmentId } from './useEnvironmentId';

describe('useEnvironmentId', () => {
  beforeEach(() => {
    mockParams = {};
  });

  it('parses endpointId from the URL', () => {
    mockParams = { endpointId: '12' };
    const { result } = renderHook(() => useEnvironmentId());
    expect(result.current).toBe(12);
  });

  it('errors when endpointId is missing and force is true', () => {
    mockParams = {};
    expect(renderHook(() => useEnvironmentId()).result.error?.message).toMatch(
      /endpointId url param is required/
    );
  });

  it('returns 0 when endpointId is missing and force is false', () => {
    mockParams = {};
    const { result } = renderHook(() => useEnvironmentId(false));
    expect(result.current).toBe(0);
  });
});
