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

interface AzureSettings {
  applicationId: string;
  tenantId: string;
  authenticationKey: string;
}

interface CreateAzureEnvironment {
  name: string;
  azure: AzureSettings;
  meta?: EnvironmentMetadata;
}

export async function createAzureEnvironment({
  name,
  azure,
  meta = { tagIds: [] },
}: CreateAzureEnvironment) {
  return createEnvironment(name, EnvironmentCreationTypes.AzureEnvironment, {
    meta,
    azure,
  });
}

export interface EnvironmentOptions {
  url?: string;
  publicUrl?: string;
  meta?: EnvironmentMetadata;
  azure?: AzureSettings;
  containerEngine?: ContainerEngine;
}

// Portainer Agent and remote Docker API environments are removed (TAI-007):
// only local sockets (and Azure until TAI-008) can be created.
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
    const { azure, meta, containerEngine } = options;
    const { groupId, tagIds = [] } = meta || {};

    payload = {
      ...payload,
      URL: options.url,
      PublicURL: options.publicUrl,
      GroupID: groupId,
      TagIds: arrayToJson(tagIds),
      ContainerEngine: containerEngine,
    };

    if (azure) {
      payload = {
        ...payload,
        AzureApplicationID: azure.applicationId,
        AzureTenantID: azure.tenantId,
        AzureAuthenticationKey: azure.authenticationKey,
      };
    }
  }

  try {
    const { data } = await endpointCreate({ body: payload });

    return toEnvironment(data);
  } catch (e) {
    throw parseAxiosError(e as Error);
  }
}
