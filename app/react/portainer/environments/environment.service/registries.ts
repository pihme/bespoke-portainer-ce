import axios, { parseAxiosError } from '@/portainer/services/axios/axios';
import {
  RegistryId,
  Registry,
} from '@/react/portainer/registries/types/registry';

import { EnvironmentId } from '../types';

import { buildUrl } from './utils';

export async function getEnvironmentRegistries(
  id: EnvironmentId,
  namespace: string
) {
  try {
    const { data } = await axios.get<Registry[]>(buildRegistryUrl(id), {
      params: { namespace },
    });
    return data;
  } catch (e) {
    throw parseAxiosError(e);
  }
}

export async function getEnvironmentRegistry(
  endpointId: EnvironmentId,
  registryId: RegistryId
) {
  try {
    const { data } = await axios.get<Registry>(
      buildRegistryUrl(endpointId, registryId)
    );
    return data;
  } catch (e) {
    throw parseAxiosError(e);
  }
}

function buildRegistryUrl(id: EnvironmentId, registryId?: RegistryId) {
  let url = `${buildUrl(id)}/registries`;

  if (registryId) {
    url += `/${registryId}`;
  }

  return url;
}
