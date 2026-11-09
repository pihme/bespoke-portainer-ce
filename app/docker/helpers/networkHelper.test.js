import { describe, it, expect } from 'vitest';

import DockerNetworkHelper from './networkHelper.js';

describe('REQ-NET-02 DockerNetworkHelper IPAM filters', () => {
  const configs = [
    { Subnet: '172.18.0.0/16' },
    { Subnet: '10.0.0.0/8' },
    { Subnet: '2001:db8::/64' },
    { Subnet: 'fd00::/8' },
    { Subnet: 'not-an-address' },
  ];

  it('getIPV4Configs keeps only dotted IPv4 subnets', () => {
    expect(DockerNetworkHelper.getIPV4Configs(configs)).toEqual([
      { Subnet: '172.18.0.0/16' },
      { Subnet: '10.0.0.0/8' },
    ]);
  });

  it('getIPV6Configs returns everything that is not IPv4', () => {
    expect(DockerNetworkHelper.getIPV6Configs(configs)).toEqual([
      { Subnet: '2001:db8::/64' },
      { Subnet: 'fd00::/8' },
      { Subnet: 'not-an-address' },
    ]);
  });

  it('getIPV4Configs returns an empty list when nothing matches', () => {
    expect(DockerNetworkHelper.getIPV4Configs([{ Subnet: '::1/128' }])).toEqual([]);
  });
});
