import { renderHook } from '@testing-library/react-hooks';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const useEnvironmentId = vi.fn();
const useEnvironment = vi.fn();

vi.mock('./useEnvironmentId', () => ({
  useEnvironmentId: (...args: unknown[]) => useEnvironmentId(...args),
}));

vi.mock('@/react/portainer/environments/queries', () => ({
  useEnvironment: (...args: unknown[]) => useEnvironment(...args),
}));

import { useCurrentEnvironment } from './useCurrentEnvironment';

describe('useCurrentEnvironment', () => {
  beforeEach(() => {
    useEnvironmentId.mockReset();
    useEnvironment.mockReset();
  });

  it('loads the environment for the current id including the snapshot', () => {
    useEnvironmentId.mockReturnValue(5);
    const query = { data: { Id: 5 } };
    useEnvironment.mockReturnValue(query);

    const { result } = renderHook(() => useCurrentEnvironment());

    expect(useEnvironmentId).toHaveBeenCalledWith(true);
    expect(useEnvironment).toHaveBeenCalledWith(5, undefined, {
      excludeSnapshot: false,
    });
    expect(result.current).toBe(query);
  });

  it('forwards force=false to useEnvironmentId', () => {
    useEnvironmentId.mockReturnValue(0);
    useEnvironment.mockReturnValue({ data: undefined });

    renderHook(() => useCurrentEnvironment(false));

    expect(useEnvironmentId).toHaveBeenCalledWith(false);
    expect(useEnvironment).toHaveBeenCalledWith(0, undefined, {
      excludeSnapshot: false,
    });
  });
});
