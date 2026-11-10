import { useMutation, useQueryClient } from '@tanstack/react-query';

import axios, { parseAxiosError } from '@/portainer/services/axios/axios';
import { EnvironmentId } from '@/react/portainer/environments/types';
import { withError, withInvalidate } from '@/react-tools/react-query';

import { buildImageFullURI } from '../utils';
import { withAgentTargetHeader } from '../../proxy/queries/utils';
import { buildDockerProxyUrl } from '../../proxy/queries/buildDockerProxyUrl';

import { queryKeys } from './queryKeys';

export function usePullImageMutation(envId: EnvironmentId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: PullImageOptions) => pullImage(args),
    ...withError('Failure', 'Failed pulling image'),
    ...withInvalidate(queryClient, [queryKeys.base(envId)]),
  });
}

interface PullImageOptions {
  environmentId: EnvironmentId;
  image: string;
  nodeName?: string;
  ignoreErrors: boolean;
}

export async function pullImage({
  environmentId,
  ignoreErrors,
  image,
  nodeName,
}: PullImageOptions) {
  const imageURI = buildImageFullURI(image);

  try {
    await axios.post(
      buildDockerProxyUrl(environmentId, 'images', 'create'),
      null,
      {
        params: {
          fromImage: imageURI,
        },
        headers: {
          ...withAgentTargetHeader(nodeName),
        },
      }
    );
  } catch (err) {
    if (ignoreErrors) {
      return;
    }

    throw parseAxiosError(err, 'Unable to pull image');
  }
}
