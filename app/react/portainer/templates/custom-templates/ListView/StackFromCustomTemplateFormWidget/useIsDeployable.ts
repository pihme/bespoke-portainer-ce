import { StackType } from '@/react/common/stacks/types';

/**
 * Docker Swarm is removed (TAI-003): only Compose custom templates deploy,
 * on every Docker engine (including one that is part of a Swarm).
 */
export function useIsDeployable(type: StackType | undefined) {
  switch (type) {
    case StackType.DockerCompose:
      return true;
    case StackType.DockerSwarm:
    case StackType.Kubernetes:
    default:
      return false;
  }
}
