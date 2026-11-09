import { renderHook } from '@testing-library/react-hooks';

import { StackType } from '@/react/common/stacks/types';

import { useIsDeployable } from './useIsDeployable';

function renderDeployability() {
  return renderHook(() => ({
    compose: useIsDeployable(StackType.DockerCompose),
    swarm: useIsDeployable(StackType.DockerSwarm),
  }));
}

describe('useIsDeployable', () => {
  it('deploys compose templates', () => {
    const { result } = renderDeployability();
    expect(result.current.compose).toBe(true);
  });

  it('REQ-TAI-003 never deploys Docker Swarm templates', () => {
    const { result } = renderDeployability();
    expect(result.current.swarm).toBe(false);
  });

  it('marks Kubernetes templates as not deployable', () => {
    const { result } = renderHook(() => useIsDeployable(StackType.Kubernetes));
    expect(result.current).toBe(false);
  });
});
