import { useMutation, useQueryClient } from '@tanstack/react-query';

import { EnvironmentId } from '@/react/portainer/environments/types';
import axios, { parseAxiosError } from '@/portainer/services/axios/axios';
import {
  buildImageFullURIFromModel,
  fullURIIntoRepoAndTag,
} from '@/react/docker/images/utils';
import { withError } from '@/react-tools/react-query';

import { queryKeys } from '../../containers/queries/query-keys';

import { buildDockerProxyUrl } from './buildDockerProxyUrl';

type CommitParams = {
  container?: string; //  The ID or name of the container to commit
  repo?: string; //  Repository name for the created image
  tag?: string; //  Tag name for the create image
  comment?: string; //  Commit message
  author?: string; //  Author of the image (e.g., John Hannibal Smith <hannibal@a-team.com>)
  pause?: boolean; //  Default: true  Whether to pause the container before committing
  changes?: string; //  Dockerfile instructions to apply while committing
};

interface MutationParams {
  environmentId: EnvironmentId;
  containerId: string;
  image: string;
}

export function useCommitContainerMutation(environmentId: EnvironmentId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      environmentId,
      containerId,
      image,
    }: MutationParams) => {
      const fullURI = buildImageFullURIFromModel({ Image: image });

      const { repo, tag } = fullURIIntoRepoAndTag(fullURI);

      return commitContainer(environmentId, {
        container: containerId,
        repo,
        tag,
      });
    },

    ...withError('Unable to create image'),
    onSuccess: (_, { containerId, environmentId }) =>
      queryClient.invalidateQueries(
        queryKeys.container(environmentId, containerId)
      ),
  });
}

export async function commitContainer(
  environmentId: EnvironmentId,
  params: CommitParams
) {
  try {
    const { data } = await axios.post<{ Id: string }>(
      buildDockerProxyUrl(environmentId, 'commit'),
      {},
      {
        params,
      }
    );
    return data;
  } catch (err) {
    throw parseAxiosError(err, 'Unable to commit container');
  }
}
