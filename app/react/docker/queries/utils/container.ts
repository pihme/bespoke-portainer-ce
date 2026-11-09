import { ContainerListViewModel } from '@/react/docker/containers/types';
import { EnvironmentId } from '@/react/portainer/environments/types';

import { buildDockerSnapshotUrl, queryKeys as rootQueryKeys } from './root';

// The edgeStackId filter went with Edge computing (TAI-004).
export type ContainersQueryParams = Record<string, never>;

export const queryKeys = {
  ...rootQueryKeys,
  containers: (environmentId: EnvironmentId) =>
    [...queryKeys.snapshot(environmentId), 'containers'] as const,
  containersQuery: (
    environmentId: EnvironmentId,
    params: ContainersQueryParams
  ) => [...queryKeys.containers(environmentId), params] as const,
  container: (
    environmentId: EnvironmentId,
    containerId: ContainerListViewModel['Id']
  ) => [...queryKeys.containers(environmentId), containerId] as const,
};

export function buildDockerSnapshotContainersUrl(
  environmentId: EnvironmentId,
  containerId?: ContainerListViewModel['Id']
) {
  let url = `${buildDockerSnapshotUrl(environmentId)}/containers`;

  if (containerId) {
    url += `/${containerId}`;
  }

  return url;
}
