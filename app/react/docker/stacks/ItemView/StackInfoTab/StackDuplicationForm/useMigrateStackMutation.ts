import { useMutation } from '@tanstack/react-query';

import { EnvironmentId } from '@/react/portainer/environments/types';
import axios, { parseAxiosError } from '@/portainer/services/axios/axios';

import { StackType } from '../../../../../common/stacks/types';
import { buildStackUrl } from '../../../../../common/stacks/queries/buildUrl';

export function useMigrateStackMutation() {
  return useMutation({
    mutationFn: routeMigrationRequest,
  });
}

export async function routeMigrationRequest({
  stackType,
  id,
  fromEnvId,
  targetEnvId,
  name,
}: {
  stackType: StackType;
  id: number;
  fromEnvId: EnvironmentId;
  targetEnvId: EnvironmentId;
  name?: string;
}) {
  if (stackType === StackType.DockerSwarm) {
    throw new Error('Docker Swarm stacks are no longer supported');
  }

  return migrateStack({ id, fromEnvId, targetEnvId, name });
}

export async function migrateStack({
  id,
  fromEnvId,
  targetEnvId,
  name,
}: {
  id: number;
  fromEnvId: EnvironmentId;
  targetEnvId: EnvironmentId;
  name?: string;
}) {
  try {
    return await axios.post(
      buildStackUrl(id, 'migrate'),
      {
        EndpointID: targetEnvId,
        Name: name,
      },
      {
        params: {
          endpointId: fromEnvId,
        },
      }
    );
  } catch (err) {
    throw parseAxiosError(err);
  }
}
