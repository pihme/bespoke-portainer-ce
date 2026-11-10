import { endpointCreate } from '@api/sdk.gen';
import { EndpointCreateData } from '@api/types.gen';

import { arrayToJson } from '@/portainer/helpers/json';
import { parseAxiosError } from '@/portainer/services/axios/axios';
import {
  type EnvironmentGroupId,
  ContainerEngine,
  EnvironmentCreationTypes,
} from '@/react/portainer/environments/types';
import { type TagId } from '@/portainer/tags/types';

import { toEnvironment } from './utils';

export interface EnvironmentMetadata {
  groupId?: EnvironmentGroupId;
  tagIds?: TagId[];
}

interface CreateLocalDockerEnvironment {
  name: string;
  socketPath?: string;
  publicUrl?: string;
  meta?: EnvironmentMetadata;
  containerEngine?: ContainerEngine;
}

export async function createLocalDockerEnvironment({
  name,
  socketPath = '',
  publicUrl = '',
  meta = { tagIds: [] },
  containerEngine,
}: CreateLocalDockerEnvironment) {
  const url = prefixPath(socketPath);

  return createEnvironment(
    name,
    EnvironmentCreationTypes.LocalDockerEnvironment,
    {
      url,
      publicUrl,
      meta,
      containerEngine,
    }
  );

  function prefixPath(path: string) {
    if (path === '') {
      return path;
    }

    // Windows named pipe
    if (path.startsWith('//./pipe/')) {
      return `npipe://${path}`;
    }

    return `unix://${path}`;
  }
}

export interface EnvironmentOptions {
  url?: string;
  publicUrl?: string;
  meta?: EnvironmentMetadata;
  containerEngine?: ContainerEngine;
}

// Portainer Agent and remote Docker API environments are removed (TAI-007):
// Azure Container Instances are removed (TAI-008): only local sockets can be
// created.
async function createEnvironment(
  name: string,
  creationType: EnvironmentCreationTypes,
  options?: EnvironmentOptions
) {
  if (creationType === EnvironmentCreationTypes.KubeConfigEnvironment) {
    throw new Error('Kube config creation is not supported on CE');
  }

  let payload: EndpointCreateData['body'] = {
    Name: name,
    EndpointCreationType: creationType,
  };

  if (options) {
    const { meta, containerEngine } = options;
    const { groupId, tagIds = [] } = meta || {};

    payload = {
      ...payload,
      URL: options.url,
      PublicURL: options.publicUrl,
      GroupID: groupId,
      TagIds: arrayToJson(tagIds),
      ContainerEngine: containerEngine,
    };
  }

  try {
    const { data } = await endpointCreate({ body: payload });

    return toEnvironment(data);
  } catch (e) {
    throw parseAxiosError(e as Error);
  }
}
