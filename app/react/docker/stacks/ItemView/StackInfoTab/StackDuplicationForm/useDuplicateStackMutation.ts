import { useMutation } from '@tanstack/react-query';

import { Pair } from '@/react/portainer/settings/types';
import { EnvironmentId } from '@/react/portainer/environments/types';

import { createStandaloneStackFromFileContent } from '../../../../../common/stacks/queries/useCreateStack/createStandaloneStackFromFileContent';
import { StackType } from '../../../../../common/stacks/types';

export function useDuplicateStackMutation() {
  return useMutation({
    mutationFn: duplicateStack,
  });
}

export async function duplicateStack({
  name,
  fileContent,
  targetEnvironmentId,
  type,
  env,
}: {
  name: string;
  fileContent: string;
  targetEnvironmentId: EnvironmentId;
  type: StackType;
  env?: Array<Pair> | null;
}) {
  if (type === StackType.DockerSwarm) {
    throw new Error('Docker Swarm stacks are no longer supported');
  }

  return createStandaloneStackFromFileContent({
    environmentId: targetEnvironmentId,
    name,
    stackFileContent: fileContent,
    env,
  });
}
