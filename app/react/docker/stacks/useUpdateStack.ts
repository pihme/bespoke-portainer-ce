import { useMutation } from '@tanstack/react-query';

import axios from '@/portainer/services/axios/axios';
import { buildStackUrl } from '@/react/common/stacks/queries/buildUrl';
import { Stack } from '@/react/common/stacks/types';

import { EnvVarValues } from '@@/form-components/EnvironmentVariablesFieldset';

export function useUpdateStackMutation() {
  return useMutation({
    mutationFn: updateStack,
  });
}

type Payload = {
  stackFileContent: string;
  env?: EnvVarValues | null;
  prune?: boolean;
  webhook?: string;
  repullImageAndRedeploy?: boolean;
  rollbackTo?: number;
  registries?: Array<number>;
};

type UpdateStackParams = {
  stackId: number;
  environmentId: number;
  payload: Payload;
};

export async function updateStack({
  stackId,
  environmentId,
  payload,
}: UpdateStackParams): Promise<Stack> {
  return axios.put(buildStackUrl(stackId), payload, {
    params: { endpointId: environmentId },
  });
}
