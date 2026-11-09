import { describe, expect, it } from 'vitest';

import { ContainerDetailsJSON } from '../../queries/useContainer';

import { getDefaultViewModel, toViewModel } from './toViewModel';

describe('REQ-CTR-03 resources toViewModel', () => {
  it('maps host config resources into the create form', () => {
    const config: ContainerDetailsJSON = {
      HostConfig: {
        Privileged: true,
        Init: true,
        Runtime: 'runc',
        Devices: [
          {
            PathOnHost: '/dev/null',
            PathInContainer: '/dev/null',
            CgroupPermissions: 'rwm',
          },
          { PathOnHost: '', PathInContainer: '' },
        ],
        Sysctls: { 'net.ipv4.ip_forward': '1' },
        SecurityOpt: ['label=disable'],
        ShmSize: 64 * 1024 * 1024,
        MemoryReservation: 128 * 1024 * 1024,
        Memory: 256 * 1024 * 1024,
        NanoCpus: 2_000_000_000,
        DeviceRequests: [],
      },
    };

    expect(toViewModel(config)).toEqual({
      runtime: { privileged: true, init: true, type: 'runc' },
      devices: [
        { pathOnHost: '/dev/null', pathInContainer: '/dev/null' },
      ],
      sysctls: [{ name: 'net.ipv4.ip_forward', value: '1' }],
      securityOpt: ['label=disable'],
      sharedMemorySize: 64,
      gpu: {
        enabled: false,
        useSpecific: false,
        selectedGPUs: ['all'],
        capabilities: ['compute', 'utility'],
      },
      resources: { reservation: 128, limit: 256, cpu: 2 },
    });
  });

  it('returns the default resources form', () => {
    expect(getDefaultViewModel()).toMatchObject({
      runtime: { privileged: false, init: false, type: '' },
      devices: [],
      sysctls: [],
      securityOpt: [],
      sharedMemorySize: 64,
      resources: { reservation: 0, limit: 0, cpu: 0 },
    });
  });
});
