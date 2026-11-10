import { endpointCreate } from '@api/sdk.gen';
import { EndpointCreateData } from '@api/types.gen';

import { parseAxiosError } from '@/portainer/services/axios/axios';
import {
  ContainerEngine,
  EnvironmentCreationTypes,
} from '@/react/portainer/environments/types';

import { toEnvironment } from './utils';

interface CreateLocalDockerEnvironment {
  name: string;
  socketPath?: string;
  publicUrl?: string;
  containerEngine?: ContainerEngine;
}

export async function createLocalDockerEnvironment({
  name,
  socketPath = '',
  publicUrl = '',
  containerEngine,
}: CreateLocalDockerEnvironment) {
  const url = prefixPath(socketPath);

  return createEnvironment(
    name,
    EnvironmentCreationTypes.LocalDockerEnvironment,
    {
      url,
      publicUrl,
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
  containerEngine?: ContainerEngine;
}

// Environment groups and tags are removed (TAI-013): no GroupID or TagIds
// are sent; the server puts every new environment in the Unassigned group.
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
    const { containerEngine } = options;

    payload = {
      ...payload,
      URL: options.url,
      PublicURL: options.publicUrl,
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
