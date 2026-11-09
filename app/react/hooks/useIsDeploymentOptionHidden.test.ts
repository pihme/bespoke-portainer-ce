import { renderHook } from '@testing-library/react-hooks';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const useEnvironmentId = vi.fn();
const useEnvironmentDeploymentOptions = vi.fn();

vi.mock('./useEnvironmentId', () => ({
  useEnvironmentId: (...args: unknown[]) => useEnvironmentId(...args),
}));

vi.mock('@/react/portainer/environments/queries/useEnvironment', () => ({
  useEnvironmentDeploymentOptions: (...args: unknown[]) =>
    useEnvironmentDeploymentOptions(...args),
}));

import { useIsDeploymentOptionHidden } from './useIsDeploymentOptionHidden';

describe('useIsDeploymentOptionHidden', () => {
  beforeEach(() => {
    useEnvironmentId.mockReset();
    useEnvironmentDeploymentOptions.mockReset();
    useEnvironmentId.mockReturnValue(1);
  });

  it('returns false while deployment options are unavailable', () => {
    useEnvironmentDeploymentOptions.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useIsDeploymentOptionHidden('form'));

    expect(result.current).toBe(false);
  });

  it('hides form, webEditor and fileUpload when hideAddWithForm is set', () => {
    useEnvironmentDeploymentOptions.mockReturnValue({
      data: { hideAddWithForm: true },
    });

    expect(
      renderHook(() => useIsDeploymentOptionHidden('form')).result.current
    ).toBe(true);
    expect(
      renderHook(() => useIsDeploymentOptionHidden('webEditor')).result.current
    ).toBe(true);
    expect(
      renderHook(() => useIsDeploymentOptionHidden('fileUpload')).result.current
    ).toBe(true);
  });

  it('keeps options visible when hideAddWithForm is false', () => {
    useEnvironmentDeploymentOptions.mockReturnValue({
      data: { hideAddWithForm: false },
    });

    expect(
      renderHook(() => useIsDeploymentOptionHidden('form')).result.current
    ).toBe(false);
  });
});
