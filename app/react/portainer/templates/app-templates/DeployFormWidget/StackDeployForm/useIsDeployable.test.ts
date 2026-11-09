import { renderHook } from '@testing-library/react-hooks';

import { TemplateType } from '../../types';

import { useIsDeployable } from './useIsDeployable';

vi.mock('@/react/hooks/useEnvironmentId', () => ({
  useEnvironmentId: () => 1,
}));

const useIsSwarmManager = vi.fn();
vi.mock('@/react/docker/proxy/queries/useInfo', () => ({
  useIsSwarmManager: (...args: unknown[]) => useIsSwarmManager(...args),
}));

describe('REQ-TPL-01 useIsDeployable for local app templates', () => {
  beforeEach(() => {
    useIsSwarmManager.mockReset();
  });

  it('always allows compose and container templates', () => {
    useIsSwarmManager.mockReturnValue(false);

    expect(
      renderHook(() => useIsDeployable(TemplateType.ComposeStack)).result
        .current
    ).toBe(true);
    expect(
      renderHook(() => useIsDeployable(TemplateType.Container)).result.current
    ).toBe(true);
  });

  it('allows swarm templates only on a swarm manager', () => {
    useIsSwarmManager.mockReturnValue(true);
    expect(
      renderHook(() => useIsDeployable(TemplateType.SwarmStack)).result.current
    ).toBe(true);

    useIsSwarmManager.mockReturnValue(false);
    expect(
      renderHook(() => useIsDeployable(TemplateType.SwarmStack)).result.current
    ).toBe(false);
  });

  it('rejects unknown template types', () => {
    useIsSwarmManager.mockReturnValue(true);
    expect(
      renderHook(() => useIsDeployable(99 as TemplateType)).result.current
    ).toBe(false);
  });
});
