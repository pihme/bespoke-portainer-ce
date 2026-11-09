import { useMutation, useQueryClient } from '@tanstack/react-query';

import axios, { parseAxiosError } from '@/portainer/services/axios/axios';
import {
  mutationOptions,
  withError,
  withInvalidate,
} from '@/react-tools/react-query';
import { TagId } from '@/portainer/tags/types';
import { queryKeys as groupQueryKeys } from '@/react/portainer/environments/environment-groups/queries/query-keys';
import { tagKeys } from '@/portainer/tags/queries';

import { EnvironmentId, EnvironmentGroupId } from '../types';
import { buildUrl } from '../environment.service/utils';

import { environmentQueryKeys } from './query-keys';

export function useUpdateEnvironmentsRelationsMutation() {
  const queryClient = useQueryClient();

  return useMutation(
    updateEnvironmentRelations,
    mutationOptions(
      withInvalidate(queryClient, [
        environmentQueryKeys.base(),
        groupQueryKeys.base(),
        tagKeys.all,
      ]),
      withError('Unable to update environment relations')
    )
  );
}

export interface EnvironmentRelationsPayload {
  group: EnvironmentGroupId;
  tags: Array<TagId>;
}

export async function updateEnvironmentRelations(
  relations: Record<EnvironmentId, EnvironmentRelationsPayload>
) {
  try {
    await axios.put(buildUrl(undefined, 'relations'), { relations });
  } catch (e) {
    throw parseAxiosError(e as Error, 'Unable to update environment relations');
  }
}
