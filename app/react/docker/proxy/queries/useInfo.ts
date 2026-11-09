import { useQuery } from '@tanstack/react-query';
import { SystemInfo } from 'docker-types';

import axios, { parseAxiosError } from '@/portainer/services/axios/axios';
import { EnvironmentId } from '@/react/portainer/environments/types';

import { buildDockerProxyUrl } from './buildDockerProxyUrl';

export async function getInfo(environmentId: EnvironmentId) {
  try {
    const { data } = await axios.get<SystemInfo>(
      buildDockerProxyUrl(environmentId, 'info')
    );
    return data;
  } catch (err) {
    throw parseAxiosError(err, 'Unable to retrieve system info');
  }
}

export function useInfo<TSelect = SystemInfo>(
  environmentId?: EnvironmentId,
  {
    enabled,
    select,
  }: { select?: (info: SystemInfo) => TSelect; enabled?: boolean } = {}
) {
  return useQuery(
    ['environment', environmentId, 'docker', 'info'],
    () => getInfo(environmentId!),
    {
      select,
      enabled: !!environmentId && enabled,
    }
  );
}

export function useIsWindows(environmentId: EnvironmentId) {
  const query = useInfo(environmentId, {
    select: (info) => info.OSType === 'windows',
  });

  return !!query.data;
}

/**
 * Docker Swarm is removed (TAI-003): every Docker environment is managed as a
 * standalone engine, even when the engine is part of a Swarm.
 */
export function useIsStandalone(
  environmentId: EnvironmentId | undefined,
  { enabled }: { enabled?: boolean } = {}
) {
  const query = useInfo(environmentId, {
    select: () => true,
    enabled,
  });

  return !!query.data;
}

/** Docker Swarm is removed (TAI-003): always false. */
export function useIsSwarm(
  _environmentId?: EnvironmentId,
  _options: { enabled?: boolean } = {}
) {
  return false;
}

export function useSystemLimits(environmentId: EnvironmentId) {
  const infoQuery = useInfo(environmentId);

  const maxCpu = infoQuery.data?.NCPU || 32;
  const maxMemory = infoQuery.data?.MemTotal
    ? Math.floor(infoQuery.data.MemTotal / 1000 / 1000)
    : 32768;

  return { maxCpu, maxMemory };
}

/** Docker Swarm is removed (TAI-003): always false. */
export function useIsSwarmManager(
  _environmentId?: EnvironmentId,
  _options: { enabled?: boolean } = {}
) {
  return false;
}
