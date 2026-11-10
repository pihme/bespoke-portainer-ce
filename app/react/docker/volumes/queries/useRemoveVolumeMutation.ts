import { Volume } from 'docker-types';

import { EnvironmentId } from '@/react/portainer/environments/types';
import axios, { parseAxiosError } from '@/portainer/services/axios/axios';

import { buildDockerProxyUrl } from '../../proxy/queries/buildDockerProxyUrl';

export async function removeVolume(
  environmentId: EnvironmentId,
  name: Volume['Name'],
  { nodeName }: { nodeName: string }
) {
  try {
    await axios.delete(buildDockerProxyUrl(environmentId, 'volumes', name));
  } catch (e) {
    throw parseAxiosError(e, 'Unable to remove volume');
  }
}
