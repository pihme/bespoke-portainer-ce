import { useMutation } from '@tanstack/react-query';

import axios from '@/portainer/services/axios/axios';
import { buildStackUrl } from '@/react/common/stacks/queries/buildUrl';
import { Stack } from '@/react/common/stacks/types';
import { withError } from '@/react-tools/react-query';

export function useAssociateStackToEnvironmentMutation() {
  return useMutation({
    mutationFn: associateStackToEnvironmentMutation,
    ...withError('Failed to associate stack to environment'),
  });
}

async function associateStackToEnvironmentMutation({
  environmentId,
  stackId,
  isOrphanedRunning,
}: {
  environmentId: number;
  stackId: number;
  isOrphanedRunning?: boolean;
}) {
  await associate({
    environmentId,
    stackId,
    isOrphanedRunning,
    });
}

async function associate({
  environmentId,
  stackId,
  isOrphanedRunning,
}: {
  environmentId: number;
  stackId: number;
  isOrphanedRunning?: boolean;
}) {
  const { data } = await axios.put<Stack>(
    buildStackUrl(stackId, 'associate'),
    {},
    {
      params: {
        endpointId: environmentId,
        orphanedRunning: isOrphanedRunning ?? false,
            },
    }
  );

  return data;
}
