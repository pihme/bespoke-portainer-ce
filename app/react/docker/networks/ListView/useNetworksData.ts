import { IPAMConfig } from 'docker-types';

import { useEnvironmentId } from '@/react/hooks/useEnvironmentId';
import { NetworkViewModel } from '@/docker/models/network';
import DockerNetworkHelper from '@/docker/helpers/networkHelper';

import { useNetworks } from '../queries/useNetworks';

import { DecoratedNetwork } from './types';

export function useNetworksData(autoRefreshRate?: number) {
  const environmentId = useEnvironmentId();

  const networksQuery = useNetworks(
    environmentId,
    // Docker Swarm is removed (TAI-003): only local-scope networks are listed.
    { local: true },
    {
      select: (networks) =>
        networks.map((n) => {
          const network = new NetworkViewModel(n);
          const ipam: NetworkViewModel['IPAM'] & {
            IPV4Configs?: Array<IPAMConfig>;
            IPV6Configs?: Array<IPAMConfig>;
          } = network.IPAM ?? {};

          ipam.IPV4Configs = DockerNetworkHelper.getIPV4Configs(ipam.Config);
          ipam.IPV6Configs = DockerNetworkHelper.getIPV6Configs(ipam.Config);

          network.IPAM = ipam;
          return {
            ...network,
            IPAM: ipam,
            Subs: [],
          } satisfies DecoratedNetwork;
        }),
      autoRefreshRate,
    }
  );
  if (!networksQuery.data) {
    return { isLoading: networksQuery.isLoading };
  }

  return {
    data: networksQuery.data,
    isLoading: networksQuery.isLoading,
  };
}
