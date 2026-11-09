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

interface TLSSettings {
  skipVerify?: boolean;
  skipClientVerify?: boolean;
  caCertFile?: File;
  certFile?: File;
  keyFile?: File;
}

export interface EnvironmentOptions {
  url?: string;
  publicUrl?: string;
  meta?: EnvironmentMetadata;
  azure?: AzureSettings;
  tls?: TLSSettings;
  containerEngine?: ContainerEngine;
}

interface CreateRemoteEnvironment {
  name: string;
  creationType: Exclude<
    EnvironmentCreationTypes,
    EnvironmentCreationTypes.EdgeAgentEnvironment
  >;
  url: string;
  options?: Omit<EnvironmentOptions, 'url'>;
  containerEngine?: ContainerEngine;
}

export async function createRemoteEnvironment({
  creationType,
  name,
  url,
  options = {},
}: CreateRemoteEnvironment) {
  return createEnvironment(name, creationType, {
    ...options,
    url: `tcp://${url}`,
  });
}

export interface CreateAgentEnvironmentValues {
  name: string;
  environmentUrl: string;
  meta: EnvironmentMetadata;
  containerEngine?: ContainerEngine;
}

export function createAgentEnvironment({
  name,
  environmentUrl,
  containerEngine = ContainerEngine.Docker,
  meta = { tagIds: [] },
}: CreateAgentEnvironmentValues) {
  return createRemoteEnvironment({
    name,
    url: environmentUrl,
    creationType: EnvironmentCreationTypes.AgentEnvironment,
    options: {
      meta,
      tls: {
        skipVerify: true,
        skipClientVerify: true,
      },
      containerEngine,
    },
  });
}

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
    const { tls, azure, meta, containerEngine } = options;
    const { groupId, tagIds = [] } = meta || {};

    payload = {
      ...payload,
      URL: options.url,
      PublicURL: options.publicUrl,
      GroupID: groupId,
      TagIds: arrayToJson(tagIds),
      ContainerEngine: containerEngine,
    };

    if (tls) {
      payload = {
        ...payload,
        TLS: true,
        TLSSkipVerify: tls.skipVerify,
        TLSSkipClientVerify: tls.skipClientVerify,
        TLSCACertFile: tls.caCertFile,
        TLSCertFile: tls.certFile,
        TLSKeyFile: tls.keyFile,
      };
    }

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
